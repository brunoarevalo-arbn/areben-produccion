// Arma las filas de la sección Precios: TODOS los productos de producción propia
// sincronizados de GN (GnProducto), con el PVP de GN + override manual, y el costo
// del escandallo cuando el producto está vinculado (ReposicionMapeo → skuLiso).
// Reusado por la API y el export.
import { prisma } from '@/lib/prisma';
import { calcular, parseDatos } from '@/lib/costos/escandallo';
import { calcularCostoMinuto } from '@/lib/costoMinuto';
import { calcularMargen } from '@/lib/costos/precios';

export interface FilaPrecio {
  gnId: number;
  code: string | null;
  nombre: string;
  marca: string;          // provider de GN (Zattia / Stunned / Areben)
  skuLiso: string;
  tipo: string;           // 'estampa' | 'produccion'
  costoAuto: number | null;   // costo del escandallo (si el SKU matchea)
  costoManual: number | null; // costo cargado a mano
  costoNeto: number | null;   // costoManual ?? costoAuto (el que se usa)
  pvpGN: number | null;   // retailer_price sincronizado
  pvpManual: number | null;
  pvpEfectivo: number | null; // pvpManual ?? pvpGN
  pvpSinIva: number | null;
  markup: number | null;
  margen: number | null;
  overrideAt: string | null;  // updatedAt del override manual (para saber qué precios están viejos)
  precioPromo: number | null;       // precio promocional confirmado en Sale
  promoDescuentoPct: number | null; // % con el que se confirmó
  promoAt: string | null;           // cuándo se confirmó
}

export interface PreciosResult {
  filas: FilaPrecio[];
  config: { ivaVenta: number; markupVentaDefault: number };
}

export async function construirFilasPrecios(): Promise<PreciosResult> {
  const [productos, mapeos, cfg, costoMinuto] = await Promise.all([
    prisma.gnProducto.findMany(),                       // todos los propios sincronizados
    prisma.reposicionMapeo.findMany({ where: { activo: true } }),
    prisma.configCostos.upsert({ where: { id: 'singleton' }, create: { id: 'singleton' }, update: {} }),
    calcularCostoMinuto(),
  ]);

  const mapeoPorId = new Map(mapeos.map((m) => [m.gnId, m]));
  const skus = [...new Set(mapeos.map((m) => m.skuLiso).filter(Boolean))];

  const [escandallos, overrides] = await Promise.all([
    prisma.escandallo.findMany({ where: { sku: { in: skus } }, orderBy: { updatedAt: 'desc' } }),
    prisma.precioProducto.findMany(),
  ]);

  const overridePorId = new Map(overrides.map((o) => [o.gnId, o]));
  const margenes = { margenDesarrollo: cfg.margenDesarrollo, margenFallas: cfg.margenFallas };

  // Costo por SKU (el más reciente si hay varios escandallos con el mismo sku).
  const costoPorSku = new Map<string, number>();
  for (const e of escandallos) {
    if (!e.sku) continue;
    if (costoPorSku.has(e.sku)) continue; // findMany viene por updatedAt desc en la práctica; primero gana
    try {
      costoPorSku.set(e.sku, calcular(parseDatos(e.datos), costoMinuto, margenes).costoTotal);
    } catch { /* escandallo con datos inválidos: sin costo */ }
  }

  const filas: FilaPrecio[] = [];
  for (const p of productos) {
    const m = mapeoPorId.get(p.gnId);                   // vinculación (opcional)
    const ov = overridePorId.get(p.gnId);
    const costoAuto = m?.skuLiso ? costoPorSku.get(m.skuLiso) ?? null : null;
    const costoManual = ov?.costoManual ?? null;
    const costoNeto = costoManual ?? costoAuto;
    const pvpGN = p.precioRetail ?? null;
    const pvpManual = ov?.pvpManual ?? null;
    const pvpEfectivo = pvpManual ?? pvpGN;
    const { pvpSinIva, markup, margen } = calcularMargen(costoNeto, pvpEfectivo, cfg.ivaVenta);
    filas.push({
      gnId: p.gnId,
      code: p.code ?? m?.gnCode ?? null,
      nombre: p.name ?? m?.gnNombre ?? '',
      marca: p.provider || '',
      skuLiso: m?.skuLiso ?? '',
      tipo: m?.tipo ?? '',
      costoAuto,
      costoManual,
      costoNeto,
      pvpGN,
      pvpManual,
      pvpEfectivo,
      pvpSinIva,
      markup,
      margen,
      overrideAt: ov ? ov.updatedAt.toISOString() : null,
      precioPromo: ov?.precioPromo ?? null,
      promoDescuentoPct: ov?.promoDescuentoPct ?? null,
      promoAt: ov?.promoAt ? ov.promoAt.toISOString() : null,
    });
  }

  // Orden: por marca y luego por nombre.
  filas.sort((a, b) => a.marca.localeCompare(b.marca) || a.nombre.localeCompare(b.nombre));

  return { filas, config: { ivaVenta: cfg.ivaVenta, markupVentaDefault: cfg.markupVentaDefault } };
}
