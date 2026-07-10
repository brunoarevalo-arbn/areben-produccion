import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAlguno } from '@/lib/auth';

// Mapa estampaId → productos que la usan: { [estampaId]: [{ id, nombre }] }.
// Lo consume el catálogo de Estampería para marcar qué estampas ya tienen producto.
export async function GET(req: NextRequest) {
  if (!(await requireAlguno(req, ['costos', 'estamperia']))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const productos = await prisma.productoEstampado.findMany({ select: { id: true, nombre: true, estampas: true } });
  const mapa: Record<string, { id: string; nombre: string }[]> = {};
  for (const p of productos) {
    const estampas = Array.isArray(p.estampas) ? p.estampas : [];
    for (const l of estampas as { estampaId?: string }[]) {
      if (!l?.estampaId) continue;
      (mapa[l.estampaId] ??= []).push({ id: p.id, nombre: p.nombre });
    }
  }
  return NextResponse.json(mapa);
}
