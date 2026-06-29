import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

// Historial de movimientos de producto terminado (ingresos por producción, ajustes,
// cargas iniciales, mermas, ventas). Opcional filtro por SKU.
export async function GET(req: NextRequest) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const sku = new URL(req.url).searchParams.get('sku')?.trim().toUpperCase();
  const movimientos = await prisma.movimientoTerminado.findMany({
    where: sku ? { sku: { contains: sku } } : undefined,
    orderBy: { fecha: 'desc' },
    take: 300,
  });
  return NextResponse.json(movimientos);
}
