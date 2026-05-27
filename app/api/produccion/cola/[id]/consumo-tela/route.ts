import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ConsumoTelaSchema } from '@/lib/validators/produccion';
import { Prisma } from '@prisma/client';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  if (session.rol !== 'admin' && session.rol !== 'diseñadora') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = ConsumoTelaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const orden = await prisma.ordenProduccion.findUnique({ where: { id } });
  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });

  if (orden.estado !== 'CORTE') {
    return NextResponse.json({ error: 'El consumo de tela solo se carga en estado CORTE' }, { status: 400 });
  }

  const { consumoRollos, notas } = parsed.data;

  // Cargar rollos con su insumo para obtener el rinde
  const rolloIds = consumoRollos.map((c) => c.rolloId);
  const rollos = await prisma.rollo.findMany({
    where: { id: { in: rolloIds } },
    include: { insumo: { select: { rinde: true, nombre: true } } },
  });
  const rollosMap = new Map(rollos.map((r) => [r.id, r]));

  // Validar
  for (const cr of consumoRollos) {
    const rollo = rollosMap.get(cr.rolloId);
    if (!rollo) return NextResponse.json({ error: `Rollo ${cr.rolloId} no encontrado` }, { status: 400 });
    if (!rollo.insumo.rinde || Number(rollo.insumo.rinde) <= 0) {
      return NextResponse.json({ error: `Insumo "${rollo.insumo.nombre}" no tiene rinde cargado. Cargalo en configuracion.` }, { status: 400 });
    }
    // Convertir metros a kg para verificar stock
    const kgNecesarios = cr.metrosUsados / Number(rollo.insumo.rinde);
    if (kgNecesarios > Number(rollo.pesoActual)) {
      return NextResponse.json({
        error: `Rollo ${rollo.codigo}: ${cr.metrosUsados}m = ${kgNecesarios.toFixed(2)}kg, pero solo tiene ${rollo.pesoActual}kg disponibles`,
      }, { status: 400 });
    }
  }

  // Calcular costo de tela y ejecutar
  let costoTela = new Prisma.Decimal(0);

  const result = await prisma.$transaction(async (tx) => {
    for (const cr of consumoRollos) {
      const rollo = rollosMap.get(cr.rolloId)!;
      const rinde = Number(rollo.insumo.rinde);
      const kgConsumidos = new Prisma.Decimal(cr.metrosUsados).div(new Prisma.Decimal(rinde));
      const costoRollo = kgConsumidos.mul(rollo.costoUnitario);
      costoTela = costoTela.add(costoRollo);

      const nuevoPeso = rollo.pesoActual.sub(kgConsumidos);
      const nuevoEstado = nuevoPeso.lte(new Prisma.Decimal('0.01')) ? 'AGOTADO' as const
        : nuevoPeso.lt(rollo.pesoInicial) ? 'EN_USO_PARCIAL' as const
        : 'DISPONIBLE' as const;

      await tx.rollo.update({
        where: { id: cr.rolloId },
        data: {
          pesoActual: nuevoPeso.lt(0) ? new Prisma.Decimal(0) : nuevoPeso,
          estado: nuevoEstado,
        },
      });

      await tx.movimientoInsumo.create({
        data: {
          tipo: 'CONSUMO',
          rolloId: cr.rolloId,
          ordenId: id,
          cantidad: kgConsumidos.neg(),
          motivo: `Consumo corte OP ${orden.sku}: ${cr.metrosUsados}m = ${kgConsumidos.toFixed(3)}kg`,
          usuarioId: session.id,
        },
      });
    }

    // Actualizar costos de la OP
    const costoTotal = orden.costoInsumosSecundarios.add(costoTela).add(orden.costoManoObra).add(orden.costoEstampa);

    const data: Record<string, unknown> = {
      costoTela,
      costoTotal,
    };

    if (notas?.trim()) {
      data.notas = (orden.notas ? orden.notas + '\n' : '') + `[Consumo tela] ${notas.trim()}`;
    }

    return tx.ordenProduccion.update({ where: { id }, data });
  });

  return NextResponse.json(result, { status: 201 });
}
