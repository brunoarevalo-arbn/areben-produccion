import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { runSyncBatch } from '@/lib/gestionnube/sync';

export const maxDuration = 60;

// Sincronización manual (resumible): hace una tanda acotada por tiempo y devuelve el
// progreso. El cliente llama de nuevo para continuar si quedó a mitad (la API de GN
// se satura). reiniciar=true para refrescar desde cero.
export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'reposicion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const res = await runSyncBatch({ budgetMs: 12000, reiniciar: !!body.reiniciar });
  const totalCache = await prisma.gnProducto.count();
  return NextResponse.json({ ...res, totalCache });
}
