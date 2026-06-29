// Cliente de la API de Gestión Nube (https://www.gestionnube.com/api/v1).
// Token Bearer desde env. La API es inestable (500 intermitentes) y solo banca
// páginas chicas (per_page <= 50), así que todo va con retry/backoff.

const BASE = 'https://www.gestionnube.com/api/v1';
const PROVEEDORES_PROPIOS = ['zattia', 'areben']; // producción propia

export class GestionNubeError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function token(): string {
  const t = process.env.GESTIONNUBE_TOKEN;
  if (!t) throw new GestionNubeError('Falta GESTIONNUBE_TOKEN en el entorno');
  return t;
}

async function gnGet<T = unknown>(path: string, tries = 4): Promise<T> {
  let last = '';
  for (let i = 0; i < tries; i++) {
    let r: Response;
    try {
      r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}`, Accept: 'application/json' } });
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
  throw new GestionNubeError(`Gestión Nube no respondió (${last}). Su API está inestable, probá de nuevo en un rato.`);
}

export interface GnProducto { id: number; code: string; name: string; category: string; provider: string; }
interface ProductosResp { data: GnProducto[]; meta?: { has_more_pages?: boolean } }

const esPropio = (p: GnProducto) => PROVEEDORES_PROPIOS.some((x) => (p.provider || '').toLowerCase().includes(x));

// Busca productos de producción propia por texto (nombre o código). Liviano: una página.
export async function buscarProductosPropios(q: string): Promise<GnProducto[]> {
  const d = await gnGet<ProductosResp>(`/productos/obtener?per_page=50&q=${encodeURIComponent(q)}`);
  return (d.data || []).filter(esPropio);
}

export interface GnInventarioRow { product_code: string; product_name: string; size_name: string; store_name: string; available_quantity: number; }
interface InventarioResp { data: GnInventarioRow[]; meta?: { has_more_pages?: boolean } }

// Stock de un código: { talle -> cantidad } sumando todas las tiendas (Local + Depósito).
export async function stockPorTalle(code: string): Promise<Record<string, number>> {
  const acc: Record<string, number> = {};
  let page = 1;
  for (;;) {
    const d = await gnGet<InventarioResp>(`/inventario/obtener?code=${encodeURIComponent(code)}&per_page=50&page=${page}`);
    for (const row of d.data || []) {
      const t = (row.size_name || '').trim() || 'UNICO';
      acc[t] = (acc[t] || 0) + (Number(row.available_quantity) || 0);
    }
    if (!d.meta?.has_more_pages || page >= 10) break;
    page++;
    await sleep(120);
  }
  return acc;
}
