import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { syncStock } from '@/lib/gestionnube/sync';

export const maxDuration = 60;

// Refresca el stock cacheado de los productos vinculados (reconsulta a GN). Manual o cron.
export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'reposicion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const res = await syncStock({ budgetMs: 50000 });
  const ult = await prisma.gnStock.findFirst({ orderBy: { syncedAt: 'desc' }, select: { syncedAt: true } });
  return NextResponse.json({ ...res, stockAt: ult?.syncedAt ?? null });
}
