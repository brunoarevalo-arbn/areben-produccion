import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { Prisma } from '@prisma/client';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const orden = await prisma.ordenProduccion.findUnique({
    where: { id },
    include: {
      movimientosInsumo: { where: { tipo: 'CONSUMO' } },
      cortesPorTalle: true,
    },
  });

  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });
  if (!orden.fichaCorteCargada) return NextResponse.json({ error: 'No hay corte registrado' }, { status: 400 });
  if (orden.terminadoAt) return NextResponse.json({ error: 'La orden ya está terminada. Retrocedela a Costura antes de revertir la ficha.' }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    for (const mov of orden.movimientosInsumo) {
      const cantidadInversa = mov.cantidad.neg();
      if (mov.rolloId) {
        await tx.rollo.update({
          where: { id: mov.rolloId },
          data: { pesoActual: { increment: cantidadInversa }, estado: 'DISPONIBLE' },
        });
      }
      if (mov.loteId) {
        await tx.lote.update({
          where: { id: mov.loteId },
          data: { cantidadActual: { increment: cantidadInversa }, estado: 'DISPONIBLE' },
        });
      }
      await tx.movimientoInsumo.create({
        data: {
          tipo: 'REVERSION',
          rolloId: mov.rolloId,
          loteId: mov.loteId,
          ordenId: id,
          cantidad: cantidadInversa,
          motivo: `Reversion corte OP ${orden.sku ?? id}`,
          usuarioId: session.id,
          reversionNota: `Revertido por ${session.nombre}`,
        },
      });
    }

    await tx.cortePorTalle.deleteMany({ where: { ordenId: id } });
    // Limpiar los avíos cargados en el corte (se vuelven a elegir al recargar la ficha).
    await tx.ordenAvio.deleteMany({ where: { ordenId: id } });

    // Revertir la ficha NO cambia el estado del flujo (la ficha está desacoplada).
    await tx.ordenProduccion.update({
      where: { id },
      data: {
        fichaCorteCargada: false,
        fichaFotoUrl: null,
        cortador: null,
        cortadorId: null,
        costoCorte: new Prisma.Decimal(0),
        costoTela: new Prisma.Decimal(0),
        costoInsumosSecundarios: new Prisma.Decimal(0),
        costoSublimacion: new Prisma.Decimal(0),
        metrosSublimados: new Prisma.Decimal(0),
        costoTotal: new Prisma.Decimal(0),
      },
    });
  });

  return NextResponse.json({ ok: true });
}
