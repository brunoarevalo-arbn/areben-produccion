import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

// fotos se guarda como JSON string de URLs (mismo formato que moodboard).
function parseFotos(s: string | null): string[] {
  if (!s) return [];
  try { const a = JSON.parse(s); return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
}
export const serializeLanzamiento = (l: { fotos: string | null }) => ({ ...l, fotos: parseFotos(l.fotos) });

function parseFecha(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const lanzamientos = await prisma.lanzamiento.findMany({ orderBy: { updatedAt: 'desc' } });
  return NextResponse.json(lanzamientos.map(serializeLanzamiento));
}

export async function POST(req: NextRequest) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { nombre, marca, fotos, estado, fechaEstimada, notas } = await req.json();
  if (!nombre?.trim() || !marca?.trim()) return NextResponse.json({ error: 'Nombre y marca son requeridos' }, { status: 400 });
  const lanzamiento = await prisma.lanzamiento.create({
    data: {
      nombre: nombre.trim(),
      marca,
      fotos: Array.isArray(fotos) && fotos.length ? JSON.stringify(fotos) : null,
      estado: estado?.trim() || 'Confirmado',
      fechaEstimada: parseFecha(fechaEstimada),
      notas: notas?.trim() || null,
    },
  });
  return NextResponse.json(serializeLanzamiento(lanzamiento), { status: 201 });
}
