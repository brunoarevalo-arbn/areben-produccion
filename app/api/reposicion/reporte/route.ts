import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

// Reporte de estampa: por cada liso, sus estampados (productos GN vinculados) con el
// stock de venta vs el mínimo → cuánto estampar por print/talle (orden para la
// diseñadora). LEE TODO DE LA CACHÉ (GnStock) — no toca la API de Gestión Nube. El
// stock se refresca aparte (botón "Actualizar stock" o cron nocturno). Mínimo = el
// específico del producto+talle, o el default global si no hay.
export async function GET(req: NextRequest) {
  const session = await requirePermiso(req, 'reposicion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const mapeos = await prisma.reposicionMapeo.findMany({ where: { activo: true } });
  if (mapeos.length === 0) return NextResponse.json({ lisos: [], stockAt: null });

  const gnIds = mapeos.map((m) => m.gnId);
  const skuLisos = [...new Set(mapeos.map((m) => m.skuLiso))];

  const [stockRows, minRows, stAreben, cfg] = await Promise.all([
    prisma.gnStock.findMany({ where: { gnId: { in: gnIds } } }),
    prisma.reposicionMinimo.findMany({ where: { gnId: { in: gnIds } } }),
    prisma.stockTerminado.findMany({ where: { sku: { in: skuLisos }, tipo: 'liso' } }),
    prisma.reposicionConfig.upsert({ where: { id: 'main' }, create: { id: 'main' }, update: {} }),
  ]);

  const def = cfg.minimoDefault;
  const stockBy: Record<number, Record<string, number>> = {};
  for (const s of stockRows) (stockBy[s.gnId] ??= {})[s.talle] = s.cantidad;
  const minBy: Record<number, Record<string, number>> = {};
  for (const m of minRows) (minBy[m.gnId] ??= {})[m.talle] = m.minimo;
  const lisoDispBy: Record<string, Record<string, number>> = {};
  for (const s of stAreben) (lisoDispBy[s.sku] ??= {})[s.talle] = (lisoDispBy[s.sku]?.[s.talle] || 0) + s.cantidad;
  const stockAt = stockRows.reduce<Date | null>((max, s) => (!max || s.syncedAt > max ? s.syncedAt : max), null);

  const porLiso = new Map<string, typeof mapeos>();
  for (const m of mapeos) {
    if (!porLiso.has(m.skuLiso)) porLiso.set(m.skuLiso, []);
    porLiso.get(m.skuLiso)!.push(m);
  }

  const lisos = [...porLiso.keys()].sort().map((skuLiso) => {
    const tallesLiso = Object.keys(lisoDispBy[skuLiso] || {});
    const prints = porLiso.get(skuLiso)!.map((m) => {
      const stock = stockBy[m.gnId] || {};
      const mins = minBy[m.gnId] || {};
      // Talles: los del stock cacheado + overrides + los del liso (así siempre hay filas,
      // aunque todavía no se haya actualizado el stock de ese producto).
      const talles = [...new Set([...Object.keys(stock), ...Object.keys(mins), ...tallesLiso])].sort();
      const filas = talles.map((talle) => {
        const stockGN = stock[talle] || 0;
        const minimoEspecifico = mins[talle];
        const minimo = minimoEspecifico ?? def;
        return { talle, stockGN, minimo, esDefault: minimoEspecifico == null, aEstampar: Math.max(0, minimo - stockGN) };
      });
      return { gnId: m.gnId, nombre: m.gnNombre, filas, aEstamparTotal: filas.reduce((s, f) => s + f.aEstampar, 0) };
    });
    return { skuLiso, lisoDisp: lisoDispBy[skuLiso] || {}, prints, aEstamparTotal: prints.reduce((s, p) => s + p.aEstamparTotal, 0) };
  });

  return NextResponse.json({ lisos, stockAt, minimoDefault: def });
}
