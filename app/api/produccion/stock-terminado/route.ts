import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

// Stock de productos terminados (lisos / estampados), por SKU + talle.
export async function GET(req: NextRequest) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const stock = await prisma.stockTerminado.findMany({
    where: { cantidad: { gt: 0 } },
    orderBy: [{ sku: 'asc' }, { talle: 'asc' }],
  });
  return NextResponse.json(stock);
}
