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
        include: {
          rollo: { include: { insumo: { select: { nombre: true, rinde: true, unidadDefault: true } }, color: { select: { nombre: true } } } },
          lote: { include: { insumo: { select: { nombre: true, unidadDefault: true } }, color: { select: { nombre: true } } } },
        },
        orderBy: { fecha: 'desc' },
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

  const { insumoTelaId, consumoLotes, fichaFotoUrl, notas } = parsed.data;

  // Verificar que el insumo de tela existe
  const insumoTela = await prisma.insumo.findUnique({ where: { id: insumoTelaId } });
  if (!insumoTela) return NextResponse.json({ error: 'Insumo de tela no encontrado' }, { status: 400 });

  // Validar y preparar lotes secundarios
  const loteConsumos = consumoLotes || [];
  const loteIds = loteConsumos.map((c) => c.loteId);
  const lotes = loteIds.length > 0 ? await prisma.lote.findMany({ where: { id: { in: loteIds } } }) : [];
  const lotesMap = new Map(lotes.map((l) => [l.id, l]));

  for (const cl of loteConsumos) {
    const lote = lotesMap.get(cl.loteId);
    if (!lote) return NextResponse.json({ error: `Lote ${cl.loteId} no encontrado` }, { status: 400 });
    if (Number(lote.cantidadActual) < cl.cantidad) {
      return NextResponse.json({ error: `Lote ${lote.codigo}: stock insuficiente` }, { status: 400 });
    }
  }

  // Calcular costo insumos secundarios
  let costoInsumosSec = new Prisma.Decimal(0);
  for (const cl of loteConsumos) {
    const lote = lotesMap.get(cl.loteId)!;
    costoInsumosSec = costoInsumosSec.add(lote.costoUnitario.mul(new Prisma.Decimal(cl.cantidad)));
  }

  const result = await prisma.$transaction(async (tx) => {
    // Descontar lotes secundarios
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
      costoInsumosSecundarios: costoInsumosSec,
      costoTotal: costoInsumosSec,
    };

    if (notas?.trim()) {
      data.notas = (orden.notas ? orden.notas + '\n' : '') + `[Ficha] ${notas.trim()}`;
    }

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
