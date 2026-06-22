// Formato único de dinero y números (es-AR). Reemplaza los ~19 helpers
// `fmt$`/`fmt` duplicados y en desacuerdo que había por archivo.

/** Monto en pesos: `$1.234`. Por defecto sin decimales (como la mayoría de las pantallas). */
export const fmtMoney = (n: number | null | undefined, decimals = 0) =>
  `$${Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

/** Número suelto: `1.234,5`. Por defecto hasta 2 decimales. */
export const fmtNum = (n: number | null | undefined, decimals = 2) =>
  Number(n ?? 0).toLocaleString('es-AR', { maximumFractionDigits: decimals });
