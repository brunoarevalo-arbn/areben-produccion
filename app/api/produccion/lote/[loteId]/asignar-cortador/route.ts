import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { z } from 'zod';

type Ctx = { params: Promise<{ loteId: string }> };
const Schema = z.object({ cortadorId: z.string().nullable() });

// Asigna (o desasigna) un cortador a TODAS las OPs del lote que aún no tienen ficha.
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { loteId } = await params;
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'cortadorId inválido' }, { status: 400 });
  const { cortadorId } = parsed.data;

  if (cortadorId) {
    const c = await prisma.cortador.findUnique({ where: { id: cortadorId } });
    if (!c) return NextResponse.json({ error: 'Cortador no encontrado' }, { status: 400 });
  }

  // Solo las que están sin ficha; no piso las que el cortador ya cargó.
  // Ojo: `{ not: 'cargado' }` en SQL no matchea NULL, así que incluyo el null explícito.
  const res = await prisma.ordenProduccion.updateMany({
    where: {
      loteId,
      fichaCorteCargada: false,
      ...(cortadorId ? { OR: [{ corteEstado: null }, { corteEstado: { not: 'cargado' } }] } : {}),
    },
    data: { cortadorId, corteEstado: cortadorId ? 'asignado' : null },
  });
  return NextResponse.json({ ok: true, actualizadas: res.count });
}
