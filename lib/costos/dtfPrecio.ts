// De dónde sale el $/metro del DTF. 🔑 UN SOLO DUEÑO: acá.
//
// Hasta el 7-sep-2026 el precio se TIPEABA en `config_costos.dtfPrecioMetro` y era una
// copia a mano de una factura. Quedó en $11.500 contra $9.500 reales —21% de más, y sobre
// TODOS los productos con estampa— sin que nada avisara: un número tipeado no tiene fecha,
// así que no se puede ver viejo. Ahora el precio sale de la COMPRA, que sí la tiene.
//
// El manual no se borró: queda de FALLBACK para el ambiente que todavía no cargó ninguna
// compra. Pero la pantalla tiene que decir CUÁL de los dos está mostrando — si las dos
// fuentes conviven sin que se vea cuál manda, la que gana termina siendo la equivocada.

export interface CompraDtfRef {
  id: string;
  fecha: string | Date;
  metros: number;
  precioMetro: number; // $ por metro de la factura, sin flete
  flete: number;       // $ del envío de ESA compra, que también se pagó por ese DTF
  proveedor?: string | null;
  numeroFactura?: string | null;
}

export type FuentePrecioDtf = 'compra' | 'manual' | 'ninguna';

export interface PrecioDtf {
  precioMetro: number | null; // `null` = no hay precio. ⛔ NO es 0: un 0 dice "es gratis".
  fuente: FuentePrecioDtf;
  compra?: CompraDtfRef;
  fecha?: Date;          // de cuándo es el precio (solo si viene de una compra)
  antiguedadDias?: number;
}

// El flete se paga por el mismo DTF, así que entra al $/metro. Antes no lo contaba nadie.
export function precioMetroDeCompra(c: CompraDtfRef): number {
  const m = c.metros || 0;
  if (m <= 0) return 0;
  return ((c.precioMetro || 0) * m + (c.flete || 0)) / m;
}

// `compras` puede venir en cualquier orden: la que manda es la MÁS RECIENTE por fecha, y
// ante empate la cargada después (una corrección del mismo día tiene que ganarle al error).
export function resolverPrecioDtf(compras: CompraDtfRef[], manual: number | null | undefined, hoy = new Date()): PrecioDtf {
  const ordenadas = [...compras].sort((a, b) => {
    const d = new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    return d !== 0 ? d : b.id.localeCompare(a.id);
  });
  const ultima = ordenadas[0];
  if (ultima && ultima.metros > 0) {
    const fecha = new Date(ultima.fecha);
    return {
      precioMetro: precioMetroDeCompra(ultima),
      fuente: 'compra',
      compra: ultima,
      fecha,
      antiguedadDias: Math.max(0, Math.floor((hoy.getTime() - fecha.getTime()) / 86400000)),
    };
  }
  if (manual && manual > 0) return { precioMetro: manual, fuente: 'manual' };
  return { precioMetro: null, fuente: 'ninguna' };
}

// Un precio de hace meses no es "el precio": es el último que se supo. La pantalla lo
// tiene que decir en vez de mostrar un número con cara de vigente.
export const DTF_PRECIO_VIEJO_DIAS = 90;
export const precioDtfVencido = (p: PrecioDtf): boolean =>
  p.fuente === 'compra' && (p.antiguedadDias ?? 0) > DTF_PRECIO_VIEJO_DIAS;
