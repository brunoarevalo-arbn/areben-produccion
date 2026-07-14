// Fórmulas de precio/margen para la sección Precios. El costo es NETO (sin IVA);
// el PVP es minorista CON IVA (como viene de Gestión Nube). Reusado por la API,
// el export a Excel y el cliente para que todo cierre igual.

export interface MargenCalc {
  pvpSinIva: number | null;   // PVP quitándole el IVA
  markup: number | null;      // % sobre el costo neto: pvpSinIva/costo - 1
  margen: number | null;      // % sobre el PVP neto: (pvpSinIva - costo)/pvpSinIva
}

// Dado costo neto y PVP (c/IVA), devuelve PVP sin IVA, markup% y margen%.
export function calcularMargen(costoNeto: number | null, pvpConIva: number | null, ivaPct: number): MargenCalc {
  if (pvpConIva == null || pvpConIva <= 0) return { pvpSinIva: null, markup: null, margen: null };
  const pvpSinIva = pvpConIva / (1 + ivaPct / 100);
  const markup = costoNeto && costoNeto > 0 ? (pvpSinIva / costoNeto - 1) * 100 : null;
  const margen = pvpSinIva > 0 ? (pvpSinIva - (costoNeto ?? 0)) / pvpSinIva * 100 : null;
  return { pvpSinIva, markup, margen };
}

// PVP (c/IVA) a partir del costo neto y un markup% sobre el costo. Inverso del anterior.
export function pvpDesdeMarkup(costoNeto: number, markupPct: number, ivaPct: number): number {
  const sinIva = costoNeto * (1 + markupPct / 100);
  return sinIva * (1 + ivaPct / 100);
}

// Aplica un % de descuento a un PVP.
export function aplicarDescuento(pvp: number, descuentoPct: number): number {
  return pvp * (1 - descuentoPct / 100);
}

// Redondea un precio para que "termine en" un número (ej. 90 → $..X90), configurable.
// modo: 'cercano' (empate → arriba) | 'arriba' (nunca por debajo) | 'abajo' (nunca por encima).
export function redondearPrecio(valor: number, terminacion = 90, modo = 'cercano'): number {
  if (!(valor > 0)) return Math.round(valor);
  const t = Math.max(0, Math.floor(terminacion));
  const M = Math.pow(10, String(t).length); // 90→100, 990→1000, 9→10
  const candBelow = Math.floor((valor - t) / M) * M + t;
  const candAbove = candBelow + M;
  if (modo === 'arriba') return candBelow >= valor ? candBelow : candAbove;
  if (modo === 'abajo')  return candAbove <= valor ? candAbove : candBelow;
  return (valor - candBelow) < (candAbove - valor) ? candBelow : candAbove; // cercano (empate → arriba)
}

// ── Margen neto real (Sale) ──────────────────────────────────────────────────
// Contempla la forma de pago (comisión, costo financiero, descuento) y canal, más
// los impuestos globales (IVA, IIBB, DREI, Ganancias). Devuelve el desglose línea
// por línea para mostrarlo transparente. Criterios validados con Bruno:
//  · descuento Sale + descuento de la forma de pago se ACUMULAN (suma), tope 100%.
//  · "aplica impuestos" de la forma gatea TODO lo impositivo: IVA, IIBB, DREI y
//    Ganancias. Si está destildada (venta sin factura), no se descuenta ninguno.
//  · Con factura: el IVA resta (ingreso neto); si saldoIvaFavor, se aclara que no
//    sale de caja (margenSinPagarIva lo suma de nuevo, informativo).
//  · IIBB y DREI sobre la venta bruta; Ganancias sobre la utilidad.
//  · comisión y costo financiero sobre el total cobrado.
export interface MargenNetoInput {
  pvp: number;                 // PVP con IVA (efectivo)
  costo: number | null;        // costo neto
  descuentoSalePct: number;    // rebaja que se está probando
  descuentoFormaPct: number;   // descuento propio de la forma de pago
  comisionPct: number;
  costoFinancieroPct: number;
  costoCanal: number;          // costo del canal por venta
  costoCanalEsPct: boolean;    // true: % sobre la venta · false: $ fijo
  aplicaImpuestos: boolean;
  ivaPct: number;
  iibbPct: number;
  dreiPct: number;
  gananciasPct: number;
  saldoIvaFavor: boolean;
}
export interface MargenNetoCalc {
  descuentoTotalPct: number;
  precioCobrado: number;       // con IVA
  precioNeto: number;          // sin IVA
  ivaDebito: number;
  comision: number;
  costoFinanciero: number;
  costoCanal: number;
  iibb: number;
  drei: number;
  ganancias: number;
  costo: number;
  margenNeto: number;          // $ por unidad
  margenNetoPct: number | null;
  margenSinPagarIva: number;   // informativo, cuando hay saldo IVA a favor
}

export function calcularMargenNeto(i: MargenNetoInput): MargenNetoCalc {
  const descuentoTotalPct = Math.min(100, Math.max(0, i.descuentoSalePct + i.descuentoFormaPct));
  const precioCobrado = i.pvp * (1 - descuentoTotalPct / 100);
  // Sin factura (no aplica impuestos) no hay IVA: el ingreso es el total cobrado.
  const ivaDebito = i.aplicaImpuestos ? precioCobrado * i.ivaPct / (100 + i.ivaPct) : 0;
  const precioNeto = precioCobrado - ivaDebito;
  const comision = i.comisionPct / 100 * precioCobrado;
  const costoFinanciero = i.costoFinancieroPct / 100 * precioCobrado;
  const costoCanal = i.costoCanalEsPct ? i.costoCanal / 100 * precioCobrado : i.costoCanal;
  const iibb = i.aplicaImpuestos ? i.iibbPct / 100 * precioCobrado : 0;
  const drei = i.aplicaImpuestos ? i.dreiPct / 100 * precioCobrado : 0;
  const costo = i.costo ?? 0;
  const utilidad = precioNeto - costo - comision - costoFinanciero - costoCanal - iibb - drei;
  const ganancias = i.aplicaImpuestos ? i.gananciasPct / 100 * Math.max(0, utilidad) : 0;
  const margenNeto = utilidad - ganancias;
  const margenNetoPct = precioNeto > 0 ? margenNeto / precioNeto * 100 : null;
  const margenSinPagarIva = i.saldoIvaFavor ? margenNeto + ivaDebito : margenNeto;
  return {
    descuentoTotalPct, precioCobrado, precioNeto, ivaDebito, comision, costoFinanciero,
    costoCanal, iibb, drei, ganancias, costo, margenNeto, margenNetoPct, margenSinPagarIva,
  };
}
