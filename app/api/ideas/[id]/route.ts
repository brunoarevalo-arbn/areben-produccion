import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { serializeIdea } from '../route';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const b = await req.json();
  const data: Record<string, unknown> = {};
  if (b.nombre !== undefined) data.nombre = String(b.nombre).trim();
  if (b.marca !== undefined) data.marca = b.marca;
  if (b.fotos !== undefined) data.fotos = Array.isArray(b.fotos) && b.fotos.length ? JSON.stringify(b.fotos) : null;
  if (b.notas !== undefined) data.notas = b.notas?.trim() || null;
  if (b.archivado !== undefined) data.archivado = !!b.archivado;
  const idea = await prisma.idea.update({ where: { id }, data });
  return NextResponse.json(serializeIdea(idea));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  await prisma.idea.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
