export const MARGEN_DEFAULT = 2.5; // 150% sobre costo

export function calcularPrecioVenta(costoTotal: number, margen = MARGEN_DEFAULT): number {
  return Math.ceil(costoTotal * margen);
}

export function calcularCostoTotal(costoTela: number, costoMO: number): number {
  return costoTela + costoMO;
}

export function necesitaReposicion(cantidadLocal: number, stockMinimo: number): boolean {
  return cantidadLocal < stockMinimo;
}

export function minutosAHorasMin(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}
