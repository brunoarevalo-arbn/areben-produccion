// Cuánto DTF pide una ORDEN de estampa, y cuánto se compró para ella.
//
// 🔑 Es el único chequeo que caza al primero que se rompa —una medida mal cargada, un
// precio mal, o un encastre peor del previsto—: contra lo que se compró de verdad. La
// primera vez que se corrió (7-sep-2026, a mano) fue justo lo que probó que costear por
// área mentía 14% para abajo. Acá deja de ser un script y pasa a estar en la pantalla.
//
// ⚠️ Esto suma TIRAS: una fila por diseño, sin mezclar. Es el techo de un encastre
// ingenuo. Un nester de verdad baja de acá, y esa diferencia es DEL PAÑO, no de la prenda.

import { tiraEstampa, type DtfConfig } from './estampaCosto';

// Qué curva le toca a cada talle. T1 = S/M, T2 = L/XL: así se cargaron las medidas
// (7-sep-2026). ⚠️ Es una convención del DATO, no una ley — si algún día una estampa se
// carga al revés, esto la lee mal y nada lo grita. Vive acá, en un solo lugar, para que
// cambiarla sea un renglón.
export type Curva = 1 | 2;
export const curvaDeTalle = (talle: string): Curva =>
  ['S', 'M', 'XS', 'P'].includes(talle.trim().toUpperCase()) ? 1 : 2;

export interface EstampaMedidas {
  anchoCm: number; largoCm: number; ancho2Cm: number; largo2Cm: number;
}
export interface ItemOrdenDtf {
  talle: string;
  cantidad: number;
  // TODAS las estampas que lleva UNA prenda de este ítem, no sólo la del ítem. 🔴 El ítem
  // apunta a una sola (la espalda), pero la prenda puede llevar también el frente, que es
  // otro planchado y otra área de DTF. Contando sólo la del ítem la orden salía 40,0 m en
  // vez de 41,5 — un número creíble y 4% corto, del tipo que no se nota nunca.
  // El que llama las resuelve por el ProductoEstampado, que es donde vive la relación.
  // Vacío = no se puede medir (órdenes de reposición: van por producto de Gestión Nube).
  estampas: EstampaMedidas[];
}

export interface ConsumoDtf {
  // `null` = no se puede medir la orden entera. ⛔ NO se devuelve la suma de las que sí
  // se pueden: una parte presentada como el total miente para abajo, y encima parece un
  // número. `sinMedida` dice cuántas prendas quedaron afuera y por qué.
  metros: number | null;
  prendas: number;
  prendasSinMedida: number;
  motivo: string | null;
}

export function consumoDtfOrden(items: ItemOrdenDtf[], cfg: DtfConfig): ConsumoDtf {
  let cm = 0, prendas = 0, sinMedida = 0, sinEstampa = 0, noEntra = 0;
  for (const it of items) {
    prendas += it.cantidad;
    if (!it.estampas.length) { sinMedida += it.cantidad; sinEstampa += it.cantidad; continue; }
    // La curva la manda el TALLE del ítem, no lo que tenga elegido el producto: acá se
    // está costeando lo que se pidió, y lo que se pidió tiene talle.
    const c = curvaDeTalle(it.talle);
    const tiras = it.estampas.map((e) =>
      tiraEstampa({ anchoCm: c === 2 ? e.ancho2Cm : e.anchoCm, largoCm: c === 2 ? e.largo2Cm : e.largoCm }, cfg));
    // Una sola cara sin medida deja al ítem entero sin medir: sumar las otras daría un
    // metraje corto con cara de completo.
    if (tiras.some((t) => !t)) { sinMedida += it.cantidad; noEntra += it.cantidad; continue; }
    cm += it.cantidad * tiras.reduce((s, t) => s + t!.largoCm, 0);
  }
  const motivo = sinMedida === 0 ? null
    : sinEstampa > 0 && noEntra > 0 ? `${sinEstampa} sin estampa y ${noEntra} sin medida`
    : sinEstampa > 0 ? `${sinEstampa} prenda(s) van por producto de Gestión Nube, sin estampa con medida`
    : `${noEntra} prenda(s) con la estampa sin medida o más grande que el rollo`;
  return { metros: sinMedida > 0 ? null : cm / 100, prendas, prendasSinMedida: sinMedida, motivo };
}

// Lo pedido contra lo comprado. `desvioPct` positivo = se compró de más.
export interface ContrasteDtf {
  metrosTira: number | null;
  metrosComprados: number | null; // null = ninguna compra vinculada a esta orden
  desvioPct: number | null;
  sobranMetros: number | null;
}
export function contrastarDtf(consumo: ConsumoDtf, metrosComprados: number | null): ContrasteDtf {
  const t = consumo.metros, k = metrosComprados;
  if (t == null || k == null || t <= 0) return { metrosTira: t, metrosComprados: k, desvioPct: null, sobranMetros: null };
  return { metrosTira: t, metrosComprados: k, desvioPct: (k / t - 1) * 100, sobranMetros: k - t };
}
