import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

// Poner vigente una versión anterior (rollback). Sólo una vigente por prenda.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requirePermiso(req, 'calculadora'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;

  const proceso = await prisma.procesoPrenda.findUnique({ where: { id }, select: { tipoPrenda: true } });
  if (!proceso) return NextResponse.json({ error: 'No existe' }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.procesoPrenda.updateMany({ where: { tipoPrenda: proceso.tipoPrenda, vigente: true }, data: { vigente: false } });
    await tx.procesoPrenda.update({ where: { id }, data: { vigente: true } });
  });

  return NextResponse.json({ ok: true });
}
