import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requirePermiso(req, 'gastos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  await prisma.gasto.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
