import { NextRequest, NextResponse } from 'next/server';
import { runSyncBatch } from '@/lib/gestionnube/sync';

export const maxDuration = 60;

// Cron nocturno: refresca el catálogo de productos propios cuando la cuota de GN
// está libre. Protegido con CRON_SECRET (Vercel Cron manda Authorization: Bearer).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }
  // Refresco completo desde cero; con la cuota libre de noche entra en un budget.
  const res = await runSyncBatch({ budgetMs: 52000, reiniciar: true });
  return NextResponse.json(res);
}
