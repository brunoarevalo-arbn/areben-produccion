import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

// fotos se guarda como JSON string de URLs (mismo formato que moodboard).
function parseFotos(s: string | null): string[] {
  if (!s) return [];
  try { const a = JSON.parse(s); return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
}
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
      fotos: Array.isArray(fotos) && fotos.length ? JSON.stringify(fotos) : null,
      notas: notas?.trim() || null,
    },
  });
  return NextResponse.json(serializeIdea(idea), { status: 201 });
}
