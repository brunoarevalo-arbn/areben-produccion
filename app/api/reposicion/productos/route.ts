import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

// Lista la copia local de productos propios (para vincular) + el SKU de liso ya
// mapeado a cada uno (si existe). Instantáneo: no toca la API de Gestión Nube.
export async function GET(req: NextRequest) {
  const session = await requirePermiso(req, 'reposicion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const [productos, mapeos] = await Promise.all([
    prisma.gnProducto.findMany({ orderBy: [{ provider: 'asc' }, { name: 'asc' }] }),
    prisma.reposicionMapeo.findMany({ where: { activo: true }, select: { gnId: true, skuLiso: true, tipo: true } }),
  ]);
  const mapByGnId = new Map(mapeos.map((m) => [m.gnId, m]));
  const ultimaSync = productos.reduce<Date | null>((max, p) => (!max || p.syncedAt > max ? p.syncedAt : max), null);

  return NextResponse.json({
    productos: productos.map((p) => {
      const m = mapByGnId.get(p.gnId);
      return { gnId: p.gnId, code: p.code, name: p.name, provider: p.provider, category: p.category, skuLiso: m?.skuLiso || null, tipo: m?.tipo || null };
    }),
    ultimaSync,
  });
}
