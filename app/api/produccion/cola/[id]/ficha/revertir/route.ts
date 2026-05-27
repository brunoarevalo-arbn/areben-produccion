import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { Prisma } from '@prisma/client';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: 'Solo admin puede revertir fichas' }, { status: 403 });

  const { id } = await params;
  const orden = await prisma.ordenProduccion.findUnique({
    where: { id },
    include: {
      movimientosInsumo: { where: { tipo: 'CONSUMO' } },
    },
  });

  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });
  if (!orden.fichaCorteCargada) return NextResponse.json({ error: 'No hay ficha cargada' }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    for (const mov of orden.movimientosInsumo) {
      const cantidadInversa = mov.cantidad.neg();

      if (mov.rolloId) {
        await tx.rollo.update({
          where: { id: mov.rolloId },
          data: {
            pesoActual: { increment: cantidadInversa },
            estado: 'DISPONIBLE',
          },
        });
      }
      if (mov.loteId) {
        await tx.lote.update({
          where: { id: mov.loteId },
          data: {
            cantidadActual: { increment: cantidadInversa },
            estado: 'DISPONIBLE',
          },
        });
      }

      await tx.movimientoInsumo.create({
        data: {
          tipo: 'REVERSION',
          rolloId: mov.rolloId,
          loteId: mov.loteId,
          ordenId: id,
          cantidad: cantidadInversa,
          motivo: `Reversion ficha OP ${orden.sku}`,
          usuarioId: session.id,
          reversionNota: `Revertido por ${session.nombre}`,
        },
      });
    }

    await tx.ordenProduccion.update({
      where: { id },
      data: {
        fichaCorteCargada: false,
        fichaFotoUrl: null,
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
        notas: 'Ficha de corte revertida',
      },
    });
  });

  return NextResponse.json({ ok: true });
}
