import { NextRequest, NextResponse } from 'next/server';
import { runSyncBatch, syncStock } from '@/lib/gestionnube/sync';

export const maxDuration = 60;

// Cron nocturno (cuota de GN libre): refresca el catálogo de productos propios y el
// stock cacheado de los vinculados. Protegido con CRON_SECRET.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }
  const productos = await runSyncBatch({ budgetMs: 30000, reiniciar: true });
  const stock = await syncStock({ budgetMs: 25000 });
  return NextResponse.json({ productos, stock });
}
