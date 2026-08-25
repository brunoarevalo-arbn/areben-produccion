import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'costos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const pasaje = await prisma.pasaje.findUnique({
    where: { id },
    include: { items: { orderBy: [{ sku: 'asc' }, { talle: 'asc' }] } },
  });
  if (!pasaje) return NextResponse.json({ error: 'Pasaje no encontrado' }, { status: 404 });
  return NextResponse.json(pasaje);
}

// Anular: suelta los movimientos para que vuelvan a la lista de pendientes. Es el único
// camino para corregir un pasaje mal cerrado — un pasaje no se edita, se rehace.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'costos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;

  const pasaje = await prisma.pasaje.findUnique({ where: { id }, select: { id: true } });
  if (!pasaje) return NextResponse.json({ error: 'Pasaje no encontrado' }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.movimientoTerminado.updateMany({ where: { pasajeId: id }, data: { pasajeId: null } });
    await tx.pasaje.delete({ where: { id } }); // los ítems caen por cascade
  });

  return NextResponse.json({ ok: true });
}
