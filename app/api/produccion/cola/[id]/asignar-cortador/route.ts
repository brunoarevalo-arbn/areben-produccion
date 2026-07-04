import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { z } from 'zod';

type Ctx = { params: Promise<{ id: string }> };

// Asigna (o desasigna) un cortador a una OP para que lo cargue desde su panel.
// No toca la ficha ni el stock; solo marca corteEstado='asignado'.
const Schema = z.object({ cortadorId: z.string().nullable() });

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'cortadorId inválido' }, { status: 400 });

  const orden = await prisma.ordenProduccion.findUnique({ where: { id }, select: { fichaCorteCargada: true, corteEstado: true } });
  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });
  if (orden.fichaCorteCargada) return NextResponse.json({ error: 'La ficha ya está cargada' }, { status: 400 });

  const { cortadorId } = parsed.data;
  if (cortadorId) {
    const c = await prisma.cortador.findUnique({ where: { id: cortadorId } });
    if (!c) return NextResponse.json({ error: 'Cortador no encontrado' }, { status: 400 });
  }
  // Si ya cargó, no piso su estado; solo (re)asigno cuando está sin cargar.
  const nuevoEstado = cortadorId ? (orden.corteEstado === 'cargado' ? 'cargado' : 'asignado') : null;
  const actualizada = await prisma.ordenProduccion.update({
    where: { id },
    data: { cortadorId: cortadorId, corteEstado: nuevoEstado },
    select: { cortadorId: true, cortador: true, corteEstado: true },
  });
  return NextResponse.json(actualizada);
}
