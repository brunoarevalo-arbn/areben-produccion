import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requirePermiso } from '@/lib/auth';
import { RegistrarCorteSchema } from '@/lib/validators/produccion';
import { Prisma } from '@prisma/client';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const orden = await prisma.ordenProduccion.findUnique({
    where: { id },
    include: {
      cortesPorTalle: { orderBy: { talle: 'asc' } },
      movimientosInsumo: {
        include: {
          rollo: { include: { insumo: { select: { nombre: true, rinde: true } }, color: { select: { nombre: true } } } },
          lote: { include: { insumo: { select: { nombre: true } }, color: { select: { nombre: true } } } },
        },
        orderBy: { fecha: 'desc' },
      },
    },
  });

  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });
  return NextResponse.json(orden);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = RegistrarCorteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const orden = await prisma.ordenProduccion.findUnique({ where: { id } });
  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });

  // La ficha es diferida: se puede cargar en cualquier estado del flujo. Para corregirla,
  // se revierte (endpoint /revertir) y se vuelve a cargar — así se devuelve el stock consumido.
  if (orden.fichaCorteCargada) {
    return NextResponse.json({ error: 'La ficha ya fue cargada. Para corregirla, revertí el corte y volvé a cargarla.' }, { status: 400 });
  }

  const { consumoRollos, consumoLotes, cortesPorTalle, avios, cortadorId, costoCorte, fichaFotoUrl, notas } = parsed.data;

  // Buscar cortador para guardar denormalizado
  let cortadorNombre: string | null = null;
  if (cortadorId) {
    const c = await prisma.cortador.findUnique({ where: { id: cortadorId } });
    if (!c) return NextResponse.json({ error: 'Cortador no encontrado' }, { status: 400 });
    cortadorNombre = c.nombre;
  }

  // Validar rollos y rinde
  const rolloIds = consumoRollos.map((c) => c.rolloId);
  const rollos = await prisma.rollo.findMany({
    where: { id: { in: rolloIds } },
    include: { insumo: { select: { rinde: true, nombre: true } } },
  });
  const rollosMap = new Map(rollos.map((r) => [r.id, r]));

  for (const cr of consumoRollos) {
    const rollo = rollosMap.get(cr.rolloId);
    if (!rollo) return NextResponse.json({ error: `Rollo ${cr.rolloId} no encontrado` }, { status: 400 });
    if (!rollo.insumo.rinde || Number(rollo.insumo.rinde) <= 0) {
      return NextResponse.json({ error: `Insumo "${rollo.insumo.nombre}" no tiene rinde cargado` }, { status: 400 });
    }
    const kgNecesarios = cr.metrosUsados / Number(rollo.insumo.rinde);
    if (kgNecesarios > Number(rollo.pesoActual)) {
      return NextResponse.json({
        error: `Rollo ${rollo.codigo}: ${cr.metrosUsados}m = ${kgNecesarios.toFixed(2)}kg, solo tiene ${rollo.pesoActual}kg`,
      }, { status: 400 });
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
      return NextResponse.json({ error: `Lote ${lote.codigo}: stock insuficiente` }, { status: 400 });
    }
  }

  // Validar talles unicos
  const tallesSet = new Set<string>();
  for (const t of cortesPorTalle) {
    if (tallesSet.has(t.talle)) {
      return NextResponse.json({ error: `Talle duplicado: ${t.talle}` }, { status: 400 });
    }
    tallesSet.add(t.talle);
  }

  // Calcular costos
  let costoTela = new Prisma.Decimal(0);
  for (const cr of consumoRollos) {
    const rollo = rollosMap.get(cr.rolloId)!;
    const rinde = Number(rollo.insumo.rinde);
    const kgConsumidos = new Prisma.Decimal(cr.metrosUsados).div(new Prisma.Decimal(rinde));
    costoTela = costoTela.add(kgConsumidos.mul(rollo.costoUnitario));
  }

  let costoInsumosSec = new Prisma.Decimal(0);
  for (const cl of loteConsumos) {
    const lote = lotesMap.get(cl.loteId)!;
    costoInsumosSec = costoInsumosSec.add(lote.costoUnitario.mul(new Prisma.Decimal(cl.cantidad)));
  }

  // Cantidad total cortada = suma de talles → reemplaza la cantidad planificada
  const cantidadTotal = cortesPorTalle.reduce((s, t) => s + t.cantidad, 0);

  const result = await prisma.$transaction(async (tx) => {
    // Descontar rollos (kg = metros / rinde)
    for (const cr of consumoRollos) {
      const rollo = rollosMap.get(cr.rolloId)!;
      const rinde = Number(rollo.insumo.rinde);
      const kgConsumidos = new Prisma.Decimal(cr.metrosUsados).div(new Prisma.Decimal(rinde));
      const nuevoPeso = rollo.pesoActual.sub(kgConsumidos);
      const nuevoEstado = nuevoPeso.lte(new Prisma.Decimal('0.01')) ? 'AGOTADO' as const
        : nuevoPeso.lt(rollo.pesoInicial) ? 'EN_USO_PARCIAL' as const
        : 'DISPONIBLE' as const;

      await tx.rollo.update({
        where: { id: cr.rolloId },
        data: { pesoActual: nuevoPeso.lt(0) ? new Prisma.Decimal(0) : nuevoPeso, estado: nuevoEstado },
      });
      await tx.movimientoInsumo.create({
        data: {
          tipo: 'CONSUMO',
          rolloId: cr.rolloId,
          ordenId: id,
          cantidad: kgConsumidos.neg(),
          motivo: `Corte OP ${orden.sku ?? id}: ${cr.metrosUsados}m = ${kgConsumidos.toFixed(3)}kg`,
          usuarioId: session.id,
        },
      });
    }

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
          motivo: `Corte OP ${orden.sku ?? id}`,
          usuarioId: session.id,
        },
      });
    }

    // Crear cortes por talle
    for (const t of cortesPorTalle) {
      await tx.cortePorTalle.create({
        data: { ordenId: id, talle: t.talle, cantidad: t.cantidad },
      });
    }

    // Avíos que lleva la prenda (del catálogo). No se descuenta acá: se anota
    // qué lleva y el stock se mueve al terminar producción.
    await tx.ordenAvio.deleteMany({ where: { ordenId: id } });
    if (avios && avios.length > 0) {
      for (const a of avios) {
        await tx.ordenAvio.create({
          data: { ordenId: id, etiquetaId: a.etiquetaId, cantidad: a.cantidad, origen: 'corte' },
        });
      }
    }

    // Actualizar OP
    const costoCorteDec = new Prisma.Decimal(costoCorte || 0);
    const costoTotal = costoTela.add(costoInsumosSec).add(costoCorteDec);
    const data: Record<string, unknown> = {
      fichaCorteCargada: true,
      fichaFotoUrl: fichaFotoUrl || null,
      cortador: cortadorNombre,
      cortadorId: cortadorId || null,
      costoCorte: costoCorteDec,
      costoTela,
      costoInsumosSecundarios: costoInsumosSec,
      costoTotal,
      cantidad: cantidadTotal,
      // La ficha ya NO cambia el estado: el avance del flujo se maneja aparte.
    };

    if (notas?.trim()) {
      data.notas = (orden.notas ? orden.notas + '\n' : '') + `[Corte] ${notas.trim()}`;
    }

    return tx.ordenProduccion.update({ where: { id }, data });
  });

  return NextResponse.json(result, { status: 201 });
}
