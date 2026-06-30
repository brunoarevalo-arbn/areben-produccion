import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { stockPorId, GestionNubeError } from '@/lib/gestionnube/client';

export const maxDuration = 60;

// Reporte de estampa: por cada liso, sus estampados (productos GN vinculados) con el
// stock de venta vs el mínimo → cuánto estampar de cada print/talle (la orden para la
// diseñadora). Muestra el liso disponible en areben como referencia. Lee stock en vivo.
export async function GET(req: NextRequest) {
  const session = await requirePermiso(req, 'reposicion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const mapeos = await prisma.reposicionMapeo.findMany({ where: { activo: true } });
  if (mapeos.length === 0) return NextResponse.json({ lisos: [], errores: [] });

  // 1. Stock de venta de cada print (por id, secuencial + throttle por el límite 100/min).
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const stockByGnId: Record<number, Record<string, number>> = {};
  const errores: { gnId: number; nombre: string | null; error: string }[] = [];
  let primero = true;
  for (const m of mapeos) {
    if (!primero) await sleep(700);
    primero = false;
    try {
      stockByGnId[m.gnId] = await stockPorId(m.gnId);
    } catch (e) {
      errores.push({ gnId: m.gnId, nombre: m.gnNombre, error: e instanceof GestionNubeError ? e.message : 'error' });
      stockByGnId[m.gnId] = {};
    }
  }
  if (errores.length === mapeos.length) {
    return NextResponse.json({ error: 'No se pudo leer ningún stock de Gestión Nube (su API está inestable). Probá de nuevo en un rato.' }, { status: 502 });
  }

  // 2. Mínimos por producto+talle.
  const gnIds = mapeos.map((m) => m.gnId);
  const minimos = await prisma.reposicionMinimo.findMany({ where: { gnId: { in: gnIds } } });
  const minByGnId: Record<number, Record<string, number>> = {};
  for (const m of minimos) (minByGnId[m.gnId] ??= {})[m.talle] = m.minimo;

  // 3. Liso disponible en areben por liso+talle (referencia).
  const skuLisos = [...new Set(mapeos.map((m) => m.skuLiso))];
  const stAreben = await prisma.stockTerminado.findMany({ where: { sku: { in: skuLisos }, tipo: 'liso' } });
  const lisoDispByLiso: Record<string, Record<string, number>> = {};
  for (const s of stAreben) (lisoDispByLiso[s.sku] ??= {})[s.talle] = (lisoDispByLiso[s.sku]?.[s.talle] || 0) + s.cantidad;

  // 4. Armar por liso → prints → talles.
  const porLiso = new Map<string, typeof mapeos>();
  for (const m of mapeos) {
    if (!porLiso.has(m.skuLiso)) porLiso.set(m.skuLiso, []);
    porLiso.get(m.skuLiso)!.push(m);
  }

  const lisos = [...porLiso.keys()].sort().map((skuLiso) => {
    const prints = porLiso.get(skuLiso)!.map((m) => {
      const stock = stockByGnId[m.gnId] || {};
      const mins = minByGnId[m.gnId] || {};
      const talles = [...new Set([...Object.keys(stock), ...Object.keys(mins)])].sort();
      const filas = talles.map((talle) => {
        const stockGN = stock[talle] || 0;
        const minimo = mins[talle] || 0;
        return { talle, stockGN, minimo, aEstampar: Math.max(0, minimo - stockGN) };
      });
      return { gnId: m.gnId, nombre: m.gnNombre, filas, aEstamparTotal: filas.reduce((s, f) => s + f.aEstampar, 0) };
    });
    return {
      skuLiso,
      lisoDisp: lisoDispByLiso[skuLiso] || {},
      prints,
      aEstamparTotal: prints.reduce((s, p) => s + p.aEstamparTotal, 0),
    };
  });

  return NextResponse.json({ lisos, errores });
}
