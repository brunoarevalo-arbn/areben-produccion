import { NextRequest, NextResponse } from 'next/server';
import { runSyncBatch, syncStock, syncVentas } from '@/lib/gestionnube/sync';

export const maxDuration = 120;

// Cron nocturno (cuota de GN libre): refresca el catálogo de productos propios, el
// stock cacheado y las ventas (90/30/7d) de los vinculados. Protegido con CRON_SECRET.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }
  const productos = await runSyncBatch({ budgetMs: 30000, reiniciar: true });
  const stock = await syncStock({ budgetMs: 25000 });
  const ventas = await syncVentas({ budgetMs: 40000 });
  return NextResponse.json({ productos, stock, ventas });
}
