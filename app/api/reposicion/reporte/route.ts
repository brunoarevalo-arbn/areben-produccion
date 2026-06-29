import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { stockPorTalle, GestionNubeError } from '@/lib/gestionnube/client';

// Reporte de reposición: por cada liso, suma el stock de sus productos de Gestión Nube
// (mapeados, Local+Depósito) + el stock de lisos en areben, lo compara con el mínimo
// y calcula cuánto producir. Lee en vivo de la API de GN (con retry).
export async function GET(req: NextRequest) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const mapeos = await prisma.reposicionMapeo.findMany({ where: { activo: true } });
  if (mapeos.length === 0) return NextResponse.json({ lisos: [], errores: [] });

  // 1. Stock de cada producto GN (secuencial, su API es frágil).
  const stockByCode: Record<string, Record<string, number>> = {};
  const errores: { gnCode: string; error: string }[] = [];
  for (const m of mapeos) {
    try {
      stockByCode[m.gnCode] = await stockPorTalle(m.gnCode);
    } catch (e) {
      errores.push({ gnCode: m.gnCode, error: e instanceof GestionNubeError ? e.message : 'error' });
      stockByCode[m.gnCode] = {};
    }
  }
  if (errores.length === mapeos.length) {
    return NextResponse.json({ error: 'No se pudo leer ningún stock de Gestión Nube (su API está inestable). Probá de nuevo en un rato.' }, { status: 502 });
  }

  // 2. Agrupar por liso → códigos GN, y acumular stock GN por talle.
  const lisosMap = new Map<string, { codigos: { gnCode: string; gnNombre: string | null }[]; gn: Record<string, number> }>();
  for (const m of mapeos) {
    if (!lisosMap.has(m.skuLiso)) lisosMap.set(m.skuLiso, { codigos: [], gn: {} });
    const e = lisosMap.get(m.skuLiso)!;
    e.codigos.push({ gnCode: m.gnCode, gnNombre: m.gnNombre });
    for (const [talle, q] of Object.entries(stockByCode[m.gnCode] || {})) e.gn[talle] = (e.gn[talle] || 0) + q;
  }

  const skuLisos = [...lisosMap.keys()];

  // 3. Stock de lisos en areben (StockTerminado tipo liso).
  const stAreben = await prisma.stockTerminado.findMany({ where: { sku: { in: skuLisos }, tipo: 'liso' } });
  const arebenByLiso: Record<string, Record<string, number>> = {};
  for (const s of stAreben) {
    (arebenByLiso[s.sku] ??= {})[s.talle] = (arebenByLiso[s.sku]?.[s.talle] || 0) + s.cantidad;
  }

  // 4. Mínimos.
  const minimos = await prisma.reposicionMinimo.findMany({ where: { skuLiso: { in: skuLisos } } });
  const minByLiso: Record<string, Record<string, number>> = {};
  for (const m of minimos) (minByLiso[m.skuLiso] ??= {})[m.talle] = m.minimo;

  // 5. Armar el reporte por liso/talle.
  const lisos = skuLisos.sort().map((skuLiso) => {
    const e = lisosMap.get(skuLiso)!;
    const talles = [...new Set([
      ...Object.keys(e.gn), ...Object.keys(arebenByLiso[skuLiso] || {}), ...Object.keys(minByLiso[skuLiso] || {}),
    ])].sort();
    const filas = talles.map((talle) => {
      const stockGN = e.gn[talle] || 0;
      const stockAreben = arebenByLiso[skuLiso]?.[talle] || 0;
      const total = stockGN + stockAreben;
      const minimo = minByLiso[skuLiso]?.[talle] || 0;
      return { talle, stockGN, stockAreben, total, minimo, aProducir: Math.max(0, minimo - total) };
    });
    return {
      skuLiso,
      codigos: e.codigos,
      filas,
      aProducirTotal: filas.reduce((s, f) => s + f.aProducir, 0),
    };
  });

  return NextResponse.json({ lisos, errores });
}
