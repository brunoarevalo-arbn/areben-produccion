import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { syncVentas } from '@/lib/gestionnube/sync';

export const maxDuration = 60;

// Refresca el caché de ventas (90/30/7d) de los productos vinculados. Manual o cron.
export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'reposicion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const res = await syncVentas({ budgetMs: 50000 });
  const ult = await prisma.gnVentas.findFirst({ orderBy: { syncedAt: 'desc' }, select: { syncedAt: true } });
  return NextResponse.json({ ...res, ventasAt: ult?.syncedAt ?? null });
}
