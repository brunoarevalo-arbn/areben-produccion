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
