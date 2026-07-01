// Resumen de consumo de tela a partir de los movimientos de rollo de una ficha de corte.
// Cada movimiento viene en la unidad del insumo (kg o metros) y el insumo tiene `rinde`
// (metros por unidad → m/kg para telas en kg). Devuelve kg y metros totales.
export interface MovConsumo { cantidad: number; unidadDefault: string | null; rinde: number | null }

export function resumenConsumoTela(movs: MovConsumo[]): { kg: number; metros: number } {
  let kg = 0, metros = 0;
  for (const m of movs) {
    const c = Math.abs(m.cantidad);
    const u = (m.unidadDefault || '').toLowerCase();
    const r = m.rinde || 0;
    if (u.includes('kg')) { kg += c; metros += c * r; }
    else { metros += c; if (r > 0) kg += c / r; }
  }
  return { kg, metros };
}
