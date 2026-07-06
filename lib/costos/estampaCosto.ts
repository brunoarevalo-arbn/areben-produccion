// Costo de una estampa DTF: el diseño (ancho × largo) ocupa una parte del rollo
// (ancho fijo, precio fijo por metro), más un % de merma por aprovechamiento.

export interface EstampaCostoInput {
  anchoCm: number;   // ancho del diseño
  largoCm: number;   // largo del diseño
  mermaPercent: number;
}
export interface DtfConfig {
  dtfPrecioMetro: number; // $ por metro de rollo
  dtfAnchoCm: number;     // ancho del rollo (ej. 58)
}

export function costoEstampa(e: EstampaCostoInput, cfg: DtfConfig): number {
  const areaRolloM2Cm = (cfg.dtfAnchoCm || 0) * 100; // cm² por metro de rollo
  if (areaRolloM2Cm <= 0) return 0;
  const areaDiseno = (e.anchoCm || 0) * (e.largoCm || 0); // cm²
  const base = (areaDiseno / areaRolloM2Cm) * (cfg.dtfPrecioMetro || 0);
  return base * (1 + (e.mermaPercent || 0) / 100);
}
