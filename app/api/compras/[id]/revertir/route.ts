import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { Prisma } from '@prisma/client';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: 'Solo admin puede revertir compras' }, { status: 403 });

  const { id } = await params;
  const compra = await prisma.compra.findUnique({
    where: { id },
    include: { rollos: true, lotes: true },
  });

  if (!compra) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });
  if (compra.revertida) return NextResponse.json({ error: 'La compra ya fue revertida' }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    for (const rollo of compra.rollos) {
      await tx.movimientoInsumo.create({
        data: {
          tipo:          'REVERSION',
          rolloId:       rollo.id,
          cantidad:      rollo.pesoActual.neg(),
          motivo:        `Reversion de compra ${compra.numeroFactura || compra.id}`,
          usuarioId:     session.id,
          reversionNota: `Compra revertida por ${session.nombre}`,
        },
      });
      await tx.rollo.update({
        where: { id: rollo.id },
        data: { pesoActual: new Prisma.Decimal(0), estado: 'DESCARTADO' },
      });
    }

    for (const lote of compra.lotes) {
      await tx.movimientoInsumo.create({
        data: {
          tipo:          'REVERSION',
          loteId:        lote.id,
          cantidad:      lote.cantidadActual.neg(),
          motivo:        `Reversion de compra ${compra.numeroFactura || compra.id}`,
          usuarioId:     session.id,
          reversionNota: `Compra revertida por ${session.nombre}`,
        },
      });
      await tx.lote.update({
        where: { id: lote.id },
        data: { cantidadActual: new Prisma.Decimal(0), estado: 'AGOTADO' },
      });
    }

    await tx.compra.update({
      where: { id },
      data: {
        revertida:    true,
        revertidaAt:  new Date(),
        revertidaPor: session.nombre,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
