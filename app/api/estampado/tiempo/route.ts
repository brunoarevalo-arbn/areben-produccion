import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

// Promedio global min/estampa a partir de las tandas de estampado.
// Mismo cálculo que /estamperia/tiempos: Σ minutosNetos / Σ cantidad.
// Lo consume el costeo de productos con estampa (subárea de Costos).
export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'costos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const tandas = await prisma.tiemposEstampado.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  const totalEstampas = tandas.reduce((s, t) => s + t.cantidad, 0);
  const totalMinutos  = tandas.reduce((s, t) => s + t.minutosNetos, 0);
  const minPorEstampa = totalEstampas > 0 ? totalMinutos / totalEstampas : 0;
  return NextResponse.json({ minPorEstampa, totalEstampas, totalMinutos });
}
