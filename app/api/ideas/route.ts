import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { parseFotos, serializeFotos } from '@/lib/diseno/fotos';

// fotos se guarda como JSON string de {url, descripcion} (mismo formato que moodboard).
export const serializeIdea = (i: { fotos: string | null }) => ({ ...i, fotos: parseFotos(i.fotos) });

export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const ideas = await prisma.idea.findMany({ orderBy: { updatedAt: 'desc' } });
  return NextResponse.json(ideas.map(serializeIdea));
}

export async function POST(req: NextRequest) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { nombre, marca, fotos, notas } = await req.json();
  if (!nombre?.trim() || !marca?.trim()) return NextResponse.json({ error: 'Nombre y marca son requeridos' }, { status: 400 });
  const idea = await prisma.idea.create({
    data: {
      nombre: nombre.trim(),
      marca,
      fotos: serializeFotos(fotos),
      notas: notas?.trim() || null,
    },
  });
  return NextResponse.json(serializeIdea(idea), { status: 201 });
}
