// Cliente de la API de Gestión Nube (https://www.gestionnube.com/api/v1) — o del ERP, que contesta LO MISMO.
// Token Bearer desde env. La API es inestable (500 intermitentes) y solo banca
// páginas chicas (per_page <= 50), así que todo va con retry/backoff.
//
// 🔑 LEER DEL ERP (Bruno 19-oct / 31-oct): con `ERP_LLAVE_PRODUCCION` en el entorno, todo se lee de
// `https://erp.arebensrl.com/api/v1` (el «lector con forma de GN» del motor: mismos recursos, campos y parámetros,
// base de Zattia con Stunned). Sin la variable, Gestión Nube como siempre ⇒ se prende y se vuelve atrás SÓLO con
// la variable de Vercel. La escritura de precios (`prisma/gn-precios-stunned.ts`) ⛔ pasa por acá: sigue en GN.

const BASE_GN = 'https://www.gestionnube.com/api/v1';
const BASE_ERP = 'https://erp.arebensrl.com/api/v1';

/** De dónde se lee: el ERP si está su llave, si no GN. */
export function origenLectura(env: Record<string, string | undefined> = process.env): { base: string; token: string | undefined; nombre: string; falta: string } {
  if (env.ERP_LLAVE_PRODUCCION) return { base: BASE_ERP, token: env.ERP_LLAVE_PRODUCCION, nombre: 'El ERP', falta: 'ERP_LLAVE_PRODUCCION' };
  return { base: BASE_GN, token: env.GESTIONNUBE_TOKEN, nombre: 'Gestión Nube', falta: 'GESTIONNUBE_TOKEN' };
}
const PROVEEDORES_PROPIOS = ['zattia', 'areben', 'stunned']; // producción propia

export class GestionNubeError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gnGet<T = unknown>(path: string, tries = 4): Promise<T> {
  const o = origenLectura();
  if (!o.token) throw new GestionNubeError(`Falta ${o.falta} en el entorno`);
  let last = '';
  for (let i = 0; i < tries; i++) {
    let r: Response;
    try {
      r = await fetch(`${o.base}${path}`, { headers: { Authorization: `Bearer ${o.token}`, Accept: 'application/json' } });
    } catch (e) {
      last = (e as Error).message; await sleep(400 * (i + 1)); continue;
    }
    if (r.ok) return r.json() as Promise<T>;
    if (r.status === 401) throw new GestionNubeError('Token inválido o expirado (401)');
    if (r.status === 403) throw new GestionNubeError('El token no tiene permiso para este endpoint (403)');
    // 500 / 429 / otros: reintentar con backoff
    last = `HTTP ${r.status}`;
    await sleep(500 * (i + 1));
  }
  throw new GestionNubeError(`${o.nombre} no respondió (${last}). Probá de nuevo en un rato.`);
}

export interface GnProducto {
  id: number; code: string; name: string; category: string; provider: string;
  retailer_price?: string | number | null;   // PVP minorista (IVA incluido), viene como string "15990.00"
  wholesaler_price?: string | number | null; // precio mayorista
}
interface ProductosResp { data: GnProducto[]; meta?: { has_more_pages?: boolean } }

// GN manda los precios como string ("15990.00"); 0/"0.00"/vacío => null (sin precio cargado).
export function parseGnPrecio(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const esPropio = (p: GnProducto) => PROVEEDORES_PROPIOS.some((x) => (p.provider || '').toLowerCase().includes(x));

// Busca productos de producción propia por texto (nombre o código). Liviano: una página.
export async function buscarProductosPropios(q: string): Promise<GnProducto[]> {
  const d = await gnGet<ProductosResp>(`/productos/obtener?per_page=50&q=${encodeURIComponent(q)}`);
  return (d.data || []).filter(esPropio);
}

// Una página cruda de productos (para sincronizar el catálogo a la copia local).
export async function paginaProductos(page: number): Promise<{ data: GnProducto[]; total: number; hayMas: boolean }> {
  const d = await gnGet<ProductosResp & { meta?: { total?: number; has_more_pages?: boolean } }>(`/productos/obtener?per_page=50&page=${page}`);
  return { data: d.data || [], total: d.meta?.total ?? 0, hayMas: !!d.meta?.has_more_pages };
}

export const esProductoPropio = esPropio;

export interface GnInventarioRow { product_code: string; product_name: string; size_name: string; store_name: string; available_quantity: number; }
interface InventarioResp { data: GnInventarioRow[]; meta?: { has_more_pages?: boolean } }

// Stock de un producto → { talle -> cantidad } sumando todas las tiendas (Local +
// Depósito). NOTA: /inventario/{id} viene roto (devuelve 0), así que buscamos por
// nombre con /inventario/obtener?q= y filtramos por product_id (el id sí es confiable).
export async function stockDeProducto(gnId: number, nombre: string): Promise<Record<string, number>> {
  const acc: Record<string, number> = {};
  if (!nombre?.trim()) return acc;
  const d = await gnGet<InventarioResp & { data?: (GnInventarioRow & { product_id?: number })[] }>(
    `/inventario/obtener?q=${encodeURIComponent(nombre.trim())}&per_page=50`,
  );
  for (const row of d.data || []) {
    if ((row as { product_id?: number }).product_id !== gnId) continue;
    const t = (row.size_name || '').trim() || 'UNICO';
    acc[t] = (acc[t] || 0) + (Number(row.available_quantity) || 0);
  }
  return acc;
}

// Ventas con detalle de líneas. Solo trae ventas activas (no archivadas, no presupuesto).
export interface GnVentaLinea { product_id: number; quantity: number; size?: string; size_info?: { name?: string }; }
export interface GnVenta { date_sale: string; items?: GnVentaLinea[]; detalles?: GnVentaLinea[]; }
interface VentasResp { data: GnVenta[]; meta?: { has_more_pages?: boolean; total?: number } }

// Una página de ventas desde `from` (YYYY-MM-DD), con líneas de detalle (product_id + quantity).
export async function paginaVentas(fromISO: string, page: number): Promise<{ data: GnVenta[]; hayMas: boolean }> {
  const d = await gnGet<VentasResp>(`/ventas/obtener?from=${fromISO}&include_details=1&per_page=100&page=${page}`);
  return { data: d.data || [], hayMas: !!d.meta?.has_more_pages };
}
