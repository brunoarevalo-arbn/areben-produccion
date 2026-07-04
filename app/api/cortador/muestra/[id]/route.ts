import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'cortador');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const cortador = await prisma.cortador.findFirst({ where: { usuarioId: session.id } });
  if (!cortador) return NextResponse.json({ error: 'Sin cortador' }, { status: 400 });

  const muestra = await prisma.corteMuestra.findUnique({ where: { id } });
  if (!muestra || muestra.cortadorId !== cortador.id) return NextResponse.json({ error: 'Muestra no encontrada' }, { status: 404 });
  if (muestra.estado !== 'pendiente') return NextResponse.json({ error: 'La muestra ya fue validada; no se puede borrar' }, { status: 400 });

  await prisma.corteMuestra.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
