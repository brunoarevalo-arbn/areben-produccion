import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Prisma } from '@prisma/client';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });
  if (session.rol !== 'admin' && session.rol !== 'diseñadora') {
    return NextResponse.json({ error: 'Sin permiso para revertir cortes' }, { status: 403 });
  }

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
          motivo: `Reversion corte OP ${orden.sku}`,
          usuarioId: session.id,
          reversionNota: `Revertido por ${session.nombre}`,
        },
      });
    }

    await tx.cortePorTalle.deleteMany({ where: { ordenId: id } });

    await tx.ordenProduccion.update({
      where: { id },
      data: {
        fichaCorteCargada: false,
        fichaFotoUrl: null,
        cortador: null,
        costoCorte: new Prisma.Decimal(0),
        costoTela: new Prisma.Decimal(0),
        costoInsumosSecundarios: new Prisma.Decimal(0),
        costoTotal: new Prisma.Decimal(0),
        estado: 'PENDIENTE',
      },
    });

    await tx.estadoTransicion.create({
      data: {
        ordenId: id,
        estadoAnterior: orden.estado,
        estadoNuevo: 'PENDIENTE',
        usuarioId: session.id,
        notas: 'Corte revertido',
      },
    });
  });

  return NextResponse.json({ ok: true });
}
