import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { FichaCorteSchema } from '@/lib/validators/produccion';
import { Prisma } from '@prisma/client';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const orden = await prisma.ordenProduccion.findUnique({
    where: { id },
    include: {
      movimientosInsumo: {
        where: { tipo: 'CONSUMO' },
        include: {
          rollo: { include: { insumo: { select: { nombre: true, unidadDefault: true } }, color: { select: { nombre: true } } } },
          lote: { include: { insumo: { select: { nombre: true, unidadDefault: true } }, color: { select: { nombre: true } } } },
        },
      },
      transiciones: { orderBy: { fecha: 'desc' }, take: 10 },
    },
  });

  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });
  return NextResponse.json(orden);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  if (session.rol !== 'admin' && session.rol !== 'diseñadora') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = FichaCorteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const orden = await prisma.ordenProduccion.findUnique({ where: { id } });
  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });

  if (orden.fichaCorteCargada) {
    return NextResponse.json({ error: 'La ficha de corte ya fue cargada' }, { status: 400 });
  }

  if (orden.estado !== 'PENDIENTE' && orden.estado !== 'CORTE') {
    return NextResponse.json({ error: 'Solo se puede cargar ficha en estado PENDIENTE o CORTE' }, { status: 400 });
  }

  const { consumoTela, consumoLotes, fichaFotoUrl, notas } = parsed.data;

  // Validar rollos existen y tienen stock
  const rolloIds = consumoTela.map((c) => c.rolloId);
  const rollos = await prisma.rollo.findMany({ where: { id: { in: rolloIds } } });
  const rollosMap = new Map(rollos.map((r) => [r.id, r]));

  for (const ct of consumoTela) {
    const rollo = rollosMap.get(ct.rolloId);
    if (!rollo) return NextResponse.json({ error: `Rollo ${ct.rolloId} no encontrado` }, { status: 400 });
    if (Number(rollo.pesoActual) < ct.cantidad) {
      return NextResponse.json({ error: `Rollo ${rollo.codigo}: stock insuficiente (${rollo.pesoActual} < ${ct.cantidad})` }, { status: 400 });
    }
  }

  // Validar lotes
  const loteConsumos = consumoLotes || [];
  const loteIds = loteConsumos.map((c) => c.loteId);
  const lotes = loteIds.length > 0 ? await prisma.lote.findMany({ where: { id: { in: loteIds } } }) : [];
  const lotesMap = new Map(lotes.map((l) => [l.id, l]));

  for (const cl of loteConsumos) {
    const lote = lotesMap.get(cl.loteId);
    if (!lote) return NextResponse.json({ error: `Lote ${cl.loteId} no encontrado` }, { status: 400 });
    if (Number(lote.cantidadActual) < cl.cantidad) {
      return NextResponse.json({ error: `Lote ${lote.codigo}: stock insuficiente (${lote.cantidadActual} < ${cl.cantidad})` }, { status: 400 });
    }
  }

  // Calcular costos
  let costoTela = new Prisma.Decimal(0);
  for (const ct of consumoTela) {
    const rollo = rollosMap.get(ct.rolloId)!;
    costoTela = costoTela.add(rollo.costoUnitario.mul(new Prisma.Decimal(ct.cantidad)));
  }

  let costoInsumosSec = new Prisma.Decimal(0);
  for (const cl of loteConsumos) {
    const lote = lotesMap.get(cl.loteId)!;
    costoInsumosSec = costoInsumosSec.add(lote.costoUnitario.mul(new Prisma.Decimal(cl.cantidad)));
  }

  const costoTotal = costoTela.add(costoInsumosSec);

  // Transaccion
  const result = await prisma.$transaction(async (tx) => {
    // Descontar rollos
    for (const ct of consumoTela) {
      const rollo = rollosMap.get(ct.rolloId)!;
      const nuevoPeso = rollo.pesoActual.sub(new Prisma.Decimal(ct.cantidad));
      const nuevoEstado = nuevoPeso.lte(0) ? 'AGOTADO' as const
        : nuevoPeso.lt(rollo.pesoInicial) ? 'EN_USO_PARCIAL' as const
        : 'DISPONIBLE' as const;

      await tx.rollo.update({
        where: { id: ct.rolloId },
        data: { pesoActual: nuevoPeso.lt(0) ? new Prisma.Decimal(0) : nuevoPeso, estado: nuevoEstado },
      });
      await tx.movimientoInsumo.create({
        data: {
          tipo: 'CONSUMO',
          rolloId: ct.rolloId,
          ordenId: id,
          cantidad: new Prisma.Decimal(ct.cantidad).neg(),
          motivo: `Ficha de corte OP ${orden.sku}`,
          usuarioId: session.id,
        },
      });
    }

    // Descontar lotes
    for (const cl of loteConsumos) {
      const lote = lotesMap.get(cl.loteId)!;
      const nuevaCant = lote.cantidadActual.sub(new Prisma.Decimal(cl.cantidad));
      const nuevoEstado = nuevaCant.lte(0) ? 'AGOTADO' as const
        : nuevaCant.lt(lote.cantidadInicial) ? 'EN_USO_PARCIAL' as const
        : 'DISPONIBLE' as const;

      await tx.lote.update({
        where: { id: cl.loteId },
        data: { cantidadActual: nuevaCant.lt(0) ? new Prisma.Decimal(0) : nuevaCant, estado: nuevoEstado },
      });
      await tx.movimientoInsumo.create({
        data: {
          tipo: 'CONSUMO',
          loteId: cl.loteId,
          ordenId: id,
          cantidad: new Prisma.Decimal(cl.cantidad).neg(),
          motivo: `Ficha de corte OP ${orden.sku}`,
          usuarioId: session.id,
        },
      });
    }

    // Actualizar OP
    const data: Record<string, unknown> = {
      fichaCorteCargada: true,
      fichaFotoUrl: fichaFotoUrl || null,
      costoTela,
      costoInsumosSecundarios: costoInsumosSec,
      costoTotal,
    };

    if (notas?.trim()) {
      data.notas = (orden.notas ? orden.notas + '\n' : '') + `[Ficha] ${notas.trim()}`;
    }

    // Transicionar a CORTE si estaba en PENDIENTE
    if (orden.estado === 'PENDIENTE') {
      data.estado = 'CORTE';
      await tx.estadoTransicion.create({
        data: {
          ordenId: id,
          estadoAnterior: 'PENDIENTE',
          estadoNuevo: 'CORTE',
          usuarioId: session.id,
          notas: 'Ficha de corte cargada',
        },
      });
    }

    return tx.ordenProduccion.update({ where: { id }, data });
  });

  return NextResponse.json(result, { status: 201 });
}
