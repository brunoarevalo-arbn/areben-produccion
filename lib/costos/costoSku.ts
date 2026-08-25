// Costo unitario del escandallo de un SKU, en un solo lugar. Antes la misma cuenta estaba
// escrita en tres: la lista de escandallos, el PDF y Precios.
//
// El costo del escandallo es NETO por construcción (precio de tela sin IVA, servicios y
// avíos sin IVA), así que sirve tal cual como valor de la mercadería que sale del taller.
import { prisma } from '@/lib/prisma';
import { calcular, parseDatos, type Margenes } from '@/lib/costos/escandallo';
import { calcularCostoMinuto } from '@/lib/costoMinuto';

/**
 * Qué márgenes se aplican:
 *  · 'congelados' → los que quedaron guardados EN el escandallo. Es lo que muestran la
 *    lista y el PDF, y lo que corresponde a un documento auditable (un pasaje cerrado no
 *    puede cambiar porque alguien tocó la configuración global).
 *  · 'config'     → los globales de ConfigCostos. Es lo que usa Precios, donde el costo se
 *    mira contra el PVP de hoy.
 * No hay default: elegir mal cambia el número en silencio.
 */
export type FuenteMargenes = 'congelados' | 'config';

export async function costoPorSku(
  skus: string[],
  fuenteMargenes: FuenteMargenes,
  opts?: { costoMinuto?: number; margenesConfig?: Margenes },
): Promise<Map<string, number>> {
  const limpios = [...new Set(skus.map((s) => s?.trim()).filter((s): s is string => !!s))];
  const out = new Map<string, number>();
  if (limpios.length === 0) return out;

  const costoMinuto = opts?.costoMinuto ?? (await calcularCostoMinuto());
  let margenesConfig = opts?.margenesConfig;
  if (fuenteMargenes === 'config' && !margenesConfig) {
    const cfg = await prisma.configCostos.upsert({ where: { id: 'singleton' }, create: { id: 'singleton' }, update: {} });
    margenesConfig = { margenDesarrollo: cfg.margenDesarrollo, margenFallas: cfg.margenFallas };
  }

  // Si hay varios escandallos con el mismo SKU gana el más reciente.
  const escandallos = await prisma.escandallo.findMany({ where: { sku: { in: limpios } }, orderBy: { updatedAt: 'desc' } });
  for (const e of escandallos) {
    if (!e.sku || out.has(e.sku)) continue;
    try {
      const datos = parseDatos(e.datos);
      const margenes = fuenteMargenes === 'congelados'
        ? { margenDesarrollo: datos.margenDesarrollo, margenFallas: datos.margenFallas }
        : margenesConfig!;
      out.set(e.sku, calcular(datos, costoMinuto, margenes).costoTotal);
    } catch { /* escandallo con datos inválidos: sin costo, no se rellena con 0 */ }
  }
  return out;
}
