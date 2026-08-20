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
  if (mapeos.length === 0) return NextResponse.json({ lisos: [], produccion: [], stockAt: null, ventasAt: null, minimoDefault: 1 });

  const gnIds = mapeos.map((m) => m.gnId);
  const skuLisos = [...new Set(mapeos.map((m) => m.skuLiso))];

  const [stockRows, minRows, stAreben, cfg, itemsAbiertos, ventasRows] = await Promise.all([
    prisma.gnStock.findMany({ where: { gnId: { in: gnIds } } }),
    prisma.reposicionMinimo.findMany({ where: { gnId: { in: gnIds } } }),
    prisma.stockTerminado.findMany({ where: { sku: { in: skuLisos }, tipo: 'liso' } }),
    prisma.reposicionConfig.upsert({ where: { id: 'main' }, create: { id: 'main' }, update: {} }),
    prisma.ordenEstampaItem.findMany({ where: { orden: { estado: { not: 'hecha' } } } }),
    prisma.gnVentas.findMany({ where: { gnId: { in: gnIds } } }),
  ]);

  const def = cfg.minimoDefault;
  const ventasBy: Record<number, Record<string, { v7: number; v30: number; v90: number }>> = {};
  for (const v of ventasRows) (ventasBy[v.gnId] ??= {})[v.talle] = { v7: v.v7, v30: v.v30, v90: v.v90 };
  const ventasAt = ventasRows.reduce<Date | null>((max, v) => (!max || v.syncedAt > max ? v.syncedAt : max), null);
  const stockBy: Record<number, Record<string, number>> = {};
  for (const s of stockRows) (stockBy[s.gnId] ??= {})[s.talle] = s.cantidad;
  const minBy: Record<number, Record<string, number>> = {};
  for (const m of minRows) (minBy[m.gnId] ??= {})[m.talle] = m.minimo;
  const lisoStockBy: Record<string, Record<string, number>> = {};
  for (const s of stAreben) (lisoStockBy[s.sku] ??= {})[s.talle] = (lisoStockBy[s.sku]?.[s.talle] || 0) + s.cantidad;
  const stockAt = stockRows.reduce<Date | null>((max, s) => (!max || s.syncedAt > max ? s.syncedAt : max), null);

  // Pendiente en órdenes abiertas (cantidad − confirmado): reserva liso y resta del sugerido.
  const pendByGnId: Record<number, Record<string, number>> = {};
  const reservByLiso: Record<string, Record<string, number>> = {};
  for (const it of itemsAbiertos) {
    const pend = it.cantidad - it.confirmado;
    if (pend <= 0) continue;
    // Un ítem de lanzamiento no tiene producto en GN, así que no descuenta de ningún
    // sugerido — pero el liso lo reserva igual: está apartado para estamparse.
    if (it.gnId != null) (pendByGnId[it.gnId] ??= {})[it.talle] = (pendByGnId[it.gnId]?.[it.talle] || 0) + pend;
    (reservByLiso[it.skuLiso] ??= {})[it.talle] = (reservByLiso[it.skuLiso]?.[it.talle] || 0) + pend;
  }
  // Liso disponible = stock − reservado.
  const lisoDispBy: Record<string, Record<string, number>> = {};
  for (const sku of skuLisos) {
    const talles = new Set([...Object.keys(lisoStockBy[sku] || {}), ...Object.keys(reservByLiso[sku] || {})]);
    for (const t of talles) (lisoDispBy[sku] ??= {})[t] = Math.max(0, (lisoStockBy[sku]?.[t] || 0) - (reservByLiso[sku]?.[t] || 0));
  }

  // Arma los grupos (por SKU) de un conjunto de mapeos. `conLiso`=true muestra el liso
  // disponible (modalidad estampa); false lo omite (producción directa).
  const construirGrupos = (ms: typeof mapeos, conLiso: boolean) => {
    const porSku = new Map<string, typeof mapeos>();
    for (const m of ms) {
      if (!porSku.has(m.skuLiso)) porSku.set(m.skuLiso, []);
      porSku.get(m.skuLiso)!.push(m);
    }
    return [...porSku.keys()].sort().map((skuLiso) => {
      const lisoDisp = conLiso ? (lisoDispBy[skuLiso] || {}) : {};
      const tallesLiso = Object.keys(lisoDisp);
      const prints = porSku.get(skuLiso)!.map((m) => {
        const stock = stockBy[m.gnId] || {};
        const mins = minBy[m.gnId] || {};
        const vts = ventasBy[m.gnId] || {};
        // Talles: stock cacheado + overrides + ventas + liso (así siempre hay filas).
        const talles = [...new Set([...Object.keys(stock), ...Object.keys(mins), ...Object.keys(vts), ...tallesLiso])].sort();
        const filas = talles.map((talle) => {
          const stockGN = stock[talle] || 0;
          const minimoEspecifico = mins[talle];
          const minimo = minimoEspecifico ?? def;
          const yaEnOrden = pendByGnId[m.gnId]?.[talle] || 0; // ya pedido en órdenes abiertas
          const ventas = vts[talle] || { v7: 0, v30: 0, v90: 0 };
          // Sugerido = faltante para el mínimo, descontando lo ya en órdenes.
          return { talle, stockGN, minimo, esDefault: minimoEspecifico == null, ventas, aEstampar: Math.max(0, minimo - stockGN - yaEnOrden) };
        });
        return { gnId: m.gnId, nombre: m.gnNombre, filas, aEstamparTotal: filas.reduce((s, f) => s + f.aEstampar, 0) };
      });
      return { skuLiso, lisoDisp, prints, aEstamparTotal: prints.reduce((s, p) => s + p.aEstamparTotal, 0) };
    });
  };

  const lisos = construirGrupos(mapeos.filter((m) => m.tipo !== 'produccion'), true);
  const produccion = construirGrupos(mapeos.filter((m) => m.tipo === 'produccion'), false);

  return NextResponse.json({ lisos, produccion, stockAt, ventasAt, minimoDefault: def });
}
