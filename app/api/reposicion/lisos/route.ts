import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAlguno } from '@/lib/auth';

// Los lisos que existen de verdad para estampar: los SKU con stock cargado en
// `stock_terminado` (tipo 'liso'). Es el universo que después descuenta la orden —
// distinto del de escandallos, que es el universo de los que tienen costo.
// Devuelve el stock por talle para poder pedir mirando lo que hay.
export async function GET(req: NextRequest) {
  const session = await requireAlguno(req, ['reposicion', 'estamperia', 'costos']);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const rows = await prisma.stockTerminado.findMany({
    where: { tipo: 'liso' },
    select: { sku: true, talle: true, cantidad: true },
    orderBy: [{ sku: 'asc' }, { talle: 'asc' }],
  });

  const porSku = new Map<string, { sku: string; talles: Record<string, number>; total: number }>();
  for (const r of rows) {
    const e = porSku.get(r.sku) ?? { sku: r.sku, talles: {}, total: 0 };
    e.talles[r.talle] = (e.talles[r.talle] ?? 0) + r.cantidad;
    e.total += r.cantidad;
    porSku.set(r.sku, e);
  }
  return NextResponse.json([...porSku.values()]);
}
