import { prisma } from '@/lib/prisma';
import { paginaProductos, esProductoPropio, stockDeProducto, GestionNubeError } from './client';

const SYNC_ID = 'main';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Refresca el stock cacheado (GnStock) de los productos vinculados, consultando la API
// por id (throttle ~700ms por el límite 100/min). Es la "reconsulta de stock" ~diaria.
export async function syncStock({ budgetMs = 50000 }: { budgetMs?: number } = {}): Promise<{ productos: number; errores: number }> {
  const mapeos = await prisma.reposicionMapeo.findMany({ where: { activo: true }, select: { gnId: true, gnNombre: true } });
  const t0 = Date.now();
  let okCount = 0, errores = 0, primero = true;
  for (const m of mapeos) {
    if (Date.now() - t0 > budgetMs) break;
    if (!primero) await sleep(700);
    primero = false;
    try {
      const stock = await stockDeProducto(m.gnId, m.gnNombre || '');
      // Reemplaza el stock de ese producto (borra talles viejos, escribe los actuales).
      await prisma.gnStock.deleteMany({ where: { gnId: m.gnId } });
      const talles = Object.keys(stock);
      if (talles.length) {
        await prisma.gnStock.createMany({ data: talles.map((t) => ({ gnId: m.gnId, talle: t, cantidad: stock[t] })) });
      }
      okCount++;
    } catch {
      errores++;
    }
  }
  return { productos: okCount, errores };
}

export interface SyncResult { done: boolean; lastPage: number; total: number; propios: number; error?: string; }

// Sincroniza el catálogo de productos propios a la copia local, de forma RESUMIBLE
// (cursor en GnSyncEstado) y acotada por tiempo. Si la API de GN se satura a mitad,
// guarda el progreso y devuelve done=false para reintentar/continuar después.
// reiniciar=true arranca de cero (refresco completo).
export async function runSyncBatch({ budgetMs = 45000, reiniciar = false }: { budgetMs?: number; reiniciar?: boolean }): Promise<SyncResult> {
  let estado = await prisma.gnSyncEstado.upsert({ where: { id: SYNC_ID }, create: { id: SYNC_ID }, update: {} });
  // Reiniciar si se pide, o si el sync anterior ya estaba completo (nuevo refresco).
  if (reiniciar || estado.completo) {
    estado = await prisma.gnSyncEstado.update({ where: { id: SYNC_ID }, data: { lastPage: 0, completo: false } });
  }

  let page = estado.lastPage + 1;
  let total = estado.total;
  let propios = 0;
  const t0 = Date.now();

  try {
    for (;;) {
      const { data, total: t, hayMas } = await paginaProductos(page);
      total = t;
      for (const p of data) {
        if (!esProductoPropio(p)) continue;
        await prisma.gnProducto.upsert({
          where:  { gnId: p.id },
          create: { gnId: p.id, code: p.code || null, name: p.name, provider: p.provider, category: p.category || null },
          update: { code: p.code || null, name: p.name, provider: p.provider, category: p.category || null },
        });
        propios++;
      }
      await prisma.gnSyncEstado.update({ where: { id: SYNC_ID }, data: { lastPage: page, total } });

      if (!hayMas) {
        await prisma.gnSyncEstado.update({ where: { id: SYNC_ID }, data: { completo: true } });
        return { done: true, lastPage: page, total, propios };
      }
      page++;
      if (Date.now() - t0 > budgetMs) return { done: false, lastPage: page - 1, total, propios };
      await sleep(700);
    }
  } catch (e) {
    const error = e instanceof GestionNubeError ? e.message : (e as Error).message;
    return { done: false, lastPage: page - 1, total, propios, error };
  }
}
