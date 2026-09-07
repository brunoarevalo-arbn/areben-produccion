// Costo de una estampa DTF.
//
// 🔑 El rollo se paga por METRO LINEAL a un ancho FIJO, así que lo que se cobra no es el
// ÁREA del diseño: es el LARGO DE ROLLO que se lleva. Un diseño de 30×30 sobre un rollo
// de 58 deja 28 cm de ancho muertos, y esos 28 cm se pagan igual.
//
// Antes esto se calculaba por área × (1 + merma%), con una merma tipeada a mano. Medido
// contra la orden de Stunned de 149 prendas (7-sep-2026): el área daba 36,9 m y la tira
// 43,2 m, contra los ~44 m que se compraron de verdad. Y el error NO es parejo —iba de
// −7% a +93% según cómo cae la pieza contra los 58 cm—, así que ninguna merma única lo
// tapa: subirla al promedio deja unas cortas y otras largas.
//
// Lo que queda de `mermaPercent` es sólo el RESIDUO (rechazos de plancha), no el
// desperdicio de encastre: eso ya está adentro de la tira. Si se dejara el 15% viejo, el
// mismo desperdicio se contaría dos veces.
//
// ⚠️ Esto cuesta UNA unidad, que es el contrato del escandallo: supone una fila del mismo
// diseño (varias unidades iguales al hilo, que es como se estampa). Mezclar diseños para
// llenar el hueco que sobra —el encastre real— ahorra más, pero ese ahorro es DEL PAÑO y
// cae entre dos cortes: no es de ninguna prenda y no vuelve acá. Va en la orden de estampa.

export interface EstampaCostoInput {
  anchoCm: number;   // ancho del diseño
  largoCm: number;   // largo del diseño
  mermaPercent: number; // % de rechazo (NO el encastre: eso lo resuelve la tira)
}
export interface DtfConfig {
  dtfPrecioMetro: number;   // $ por metro de rollo
  dtfAnchoCm: number;       // ancho del rollo (ej. 58)
  dtfSeparacionCm?: number; // margen de corte entre estampas (a lo ancho y a lo largo)
}

// Cómo cae UNA unidad sobre el rollo. `null` = no hay tira posible: o falta la medida, o
// el diseño no entra ni girado. Las dos cosas tienen que llegar a la pantalla como
// "no entra" / "falta la medida", nunca como $0 — un cero acá AFIRMA que no cuesta nada.
export interface TiraEstampa {
  porFila: number;  // cuántas entran a lo ancho del rollo
  girada: boolean;  // si conviene apoyarla girada 90°
  largoCm: number;  // largo de rollo que se lleva UNA unidad
}

export function tiraEstampa(e: Pick<EstampaCostoInput, 'anchoCm' | 'largoCm'>, cfg: DtfConfig): TiraEstampa | null {
  const W = cfg.dtfAnchoCm || 0;
  const sep = cfg.dtfSeparacionCm ?? 0;
  const a = e.anchoCm || 0, l = e.largoCm || 0;
  if (W <= 0 || a <= 0 || l <= 0) return null;

  const opciones: TiraEstampa[] = [];
  // apoyada: el ancho del diseño va a lo ancho del rollo
  const n1 = Math.floor(W / (a + sep));
  if (n1 >= 1) opciones.push({ porFila: n1, girada: false, largoCm: (l + sep) / n1 });
  // girada 90°: el largo del diseño va a lo ancho del rollo
  const n2 = Math.floor(W / (l + sep));
  if (n2 >= 1) opciones.push({ porFila: n2, girada: true, largoCm: (a + sep) / n2 });
  if (!opciones.length) return null; // más grande que el rollo en las dos orientaciones

  return opciones.sort((x, y) => x.largoCm - y.largoCm)[0];
}

// `null` cuando no hay tira posible. El que llama TIENE que decidir qué dibujar: sumar 0
// convierte "no se puede" en "es gratis".
export function costoEstampa(e: EstampaCostoInput, cfg: DtfConfig): number | null {
  const t = tiraEstampa(e, cfg);
  if (!t) return null;
  // Sin precio del DTF no hay costo. Multiplicar por 0 devolvería $0, que es la misma
  // mentira que el área nunca diciendo "no entra": afirma que estampar sale gratis.
  if (!(cfg.dtfPrecioMetro > 0)) return null;
  return (t.largoCm / 100) * cfg.dtfPrecioMetro * (1 + (e.mermaPercent || 0) / 100);
}

// Para la pantalla: "2/fila girada · 24,2 cm de rollo". El que compra el DTF necesita
// saber que el BUZO STND (66 cm) entra GIRADO en un rollo de 58, no que "cuesta $2.568".
export function tiraDetalle(t: TiraEstampa): string {
  return `${t.porFila}/fila${t.girada ? ' girada' : ''} · ${t.largoCm.toFixed(1)} cm de rollo`;
}
