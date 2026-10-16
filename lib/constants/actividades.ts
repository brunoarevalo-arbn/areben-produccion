// La actividad de costura de producción. La comparten la tablet (que exige orden o
// "trabajo libre" para guardarla) y `lib/tiempos/registrar.ts` (que cobra el libre
// como gasto de taller). Vive acá y no en `registrar.ts` porque ése importa
// `prisma`, y un `'use client'` que lo importe lleva el driver al navegador.
export const ACTIVIDAD_PROCESO = 'Proceso Completado';

/**
 * Qué campos puede llevar cada actividad (Bruno, 16-oct: «si es almuerzo o descanso, que no
 * pueda asignar SKU»). Las que no están acá (el proceso y las muestras) llevan todo.
 *
 * 🔴 Lo que lo trajo: el 7-oct el ALMUERZO se guardó con SKU, pieza y máquina de la RAYROS
 * —la orden quedaba seleccionada al tocar «Almuerzo» y la tablet la mandaba igual— y el costo
 * ⛔ filtra por actividad ⇒ 30 min de almuerzo se cobraban como remallado.
 * - pausas: ni orden ni máquina.
 * - paradas: la máquina sí (dice QUÉ se rompió), la orden no: una parada ya está en el
 *   `costoMinuto`, cargarla además a la orden la cobra dos veces.
 */
const SIN_ORDEN: Record<string, { maquina: boolean }> = {
  Almuerzo: { maquina: false },
  Descanso: { maquina: false },
  'Falla Máquina': { maquina: true },
  'Cambio Hilo': { maquina: true },
};

export function llevaOrden(actividad: string): boolean {
  return !(actividad in SIN_ORDEN);
}

export function llevaMaquina(actividad: string): boolean {
  return SIN_ORDEN[actividad]?.maquina ?? true;
}

type ConOrden = { actividad?: string | null; sku?: string | null; parte?: string | null; lote?: number | null; marca?: string | null; maquina?: string | null };

/**
 * Saca de un registro lo que su actividad no puede llevar. Se aplica en la tablet Y en el
 * servidor (alta y edición): una tablet con el código viejo cargado sigue mandando el SKU.
 * Limpia en vez de rechazar a propósito: rechazar le haría perder el almuerzo a la costurera.
 */
export function limpiarSegunActividad<T extends ConOrden>(r: T): T {
  if (!r.actividad || llevaOrden(r.actividad)) return r;
  // `undefined` y no `null`: el alta lo valida zod (`optional`, ⛔ `nullable`) y Prisma lo
  // guarda NULL igual.
  const limpio = { ...r, sku: undefined, parte: undefined, lote: undefined, marca: undefined };
  if (!llevaMaquina(r.actividad)) limpio.maquina = undefined;
  return limpio;
}
