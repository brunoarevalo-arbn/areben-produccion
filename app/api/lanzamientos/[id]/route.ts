import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { serializeLanzamiento } from '../route';
import { serializeFotos } from '@/lib/diseno/fotos';

type Ctx = { params: Promise<{ id: string }> };

function parseFecha(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const b = await req.json();
  const data: Record<string, unknown> = {};
  if (b.nombre !== undefined) data.nombre = String(b.nombre).trim();
  if (b.marca !== undefined) data.marca = b.marca;
  if (b.fotos !== undefined) data.fotos = serializeFotos(b.fotos);
  if (b.estado !== undefined) data.estado = String(b.estado).trim() || 'Confirmado';
  if (b.fechaEstimada !== undefined) data.fechaEstimada = parseFecha(b.fechaEstimada);
  if (b.notas !== undefined) data.notas = b.notas?.trim() || null;
  const lanzamiento = await prisma.lanzamiento.update({ where: { id }, data });
  return NextResponse.json(serializeLanzamiento(lanzamiento));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  await prisma.lanzamiento.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
