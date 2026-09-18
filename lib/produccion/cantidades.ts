// Las TRES cantidades de una orden de producción, con un nombre cada una.
//
// 🔴 Antes eran un solo campo (`OrdenProduccion.cantidad`) que se pisaba cuatro veces:
// nacía planificado, lo pisaba la carga del cortador, lo volvía a pisar la carga del
// taller y la ficha de tela (las tres con lo CORTADO) y al terminar costura lo pisaba lo
// PRODUCIDO. Como el costo unitario es `costoTotal / cantidad`, el denominador cambiaba
// solo: entrar 20 de un corte de 100 dejaba la tela de las 100 dividida por 20. Ésa era
// la "progresión a ojo" que había que hacer a mano.
//
// Ahora:
//   planificada → `OrdenProduccion.cantidad`, la escribe sólo el alta (y la edición)
//   cortada     → `OrdenProduccion.cantidadCortada`, la escriben las tres cargas de corte
//   ingresada   → se DERIVA de los MovimientoTerminado de la orden; no se guarda, para
//                 que no pueda desincronizarse de los movimientos que la producen
//
// ⚠️ El costo de material se reparte por lo CORTADO, nunca por lo ingresado: la tela ya
// se consumió entera el día del corte, entre las unidades que salgan de él.
import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/** Lo cortado según la orden; cae a lo planificado mientras no haya corte cargado. */
export function cantidadCortada(orden: { cantidad: number; cantidadCortada: number | null }): number {
  return orden.cantidadCortada ?? orden.cantidad;
}

/** De dónde salió el denominador que se usó para repartir un costo. */
export type OrigenBase = 'cortado' | 'planificado';

/**
 * El denominador del costo unitario de material **y de dónde vino**.
 *
 * 🔴 `cantidadCortada()` cae a lo planificado cuando no hay corte cargado, y el número
 * que devuelve **no dice cuál de las dos es**: 40 puede ser "se cortaron 40" o "nadie
 * cortó nada y hay 40 planificadas". Un consumidor que rotule "cortado" sobre eso miente,
 * y si además CONGELA el resultado —como hace un lote— la mentira ya no se puede corregir
 * después. La procedencia se devuelve acá, una sola vez, en vez de que cada consumidor la
 * re-derive: derivarla de `n > 0` es la forma natural de equivocarse.
 */
export function baseDeRepartoConOrigen(
  orden: { cantidad: number; cantidadCortada: number | null },
): { unidades: number; origen: OrigenBase } | null {
  const n = cantidadCortada(orden);
  if (n <= 0) return null;
  return { unidades: n, origen: orden.cantidadCortada != null ? 'cortado' : 'planificado' };
}

/** Denominador del costo unitario de material. `null` si todavía no hay nada que repartir. */
export function baseDeReparto(orden: { cantidad: number; cantidadCortada: number | null }): number | null {
  return baseDeRepartoConOrigen(orden)?.unidades ?? null;
}

/** Lo realmente ingresado a stock por producción, sumado de los movimientos de la orden. */
export async function cantidadIngresada(db: Db, ordenId: string): Promise<number> {
  const r = await db.movimientoTerminado.aggregate({
    where: { ordenId, origen: 'produccion' },
    _sum: { cantidad: true },
  });
  return r._sum.cantidad ?? 0;
}

/** Lo ingresado de varias órdenes de una sola consulta: `ordenId → unidades`. */
export async function ingresadasPorOrden(db: Db, ordenIds: string[]): Promise<Map<string, number>> {
  if (ordenIds.length === 0) return new Map();
  const filas = await db.movimientoTerminado.groupBy({
    by: ['ordenId'],
    where: { ordenId: { in: ordenIds }, origen: 'produccion' },
    _sum: { cantidad: true },
  });
  const m = new Map<string, number>();
  for (const f of filas) if (f.ordenId) m.set(f.ordenId, f._sum.cantidad ?? 0);
  return m;
}
