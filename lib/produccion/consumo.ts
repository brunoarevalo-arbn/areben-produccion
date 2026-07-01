// Resumen de consumo de tela a partir de los movimientos de rollo de una ficha de corte.
// IMPORTANTE: una ficha editada acumula varios movimientos por rollo (CONSUMO, REVERSION,
// CONSUMO…). El consumo real es el NETO por rollo (suma con signo: consumo negativo,
// reversión positiva). Cada movimiento viene en la unidad del insumo (kg o metros) y el
// insumo tiene `rinde` (metros por unidad → m/kg para telas en kg).
export interface MovConsumo { rolloId?: string | null; cantidad: number; unidadDefault: string | null; rinde: number | null }

export interface ConsumoRollo { consumo: number; unidadDefault: string | null; rinde: number | null }

// Neto consumido por rollo (>0), más los totales kg/metros.
export function consumoNetoPorRollo(movs: MovConsumo[]): { kg: number; metros: number; porRollo: Map<string, ConsumoRollo> } {
  const net = new Map<string, { c: number; unidadDefault: string | null; rinde: number | null }>();
  for (const m of movs) {
    if (!m.rolloId) continue;
    const cur = net.get(m.rolloId) ?? { c: 0, unidadDefault: m.unidadDefault, rinde: m.rinde };
    cur.c += m.cantidad; // con signo: CONSUMO (−), REVERSION (+)
    net.set(m.rolloId, cur);
  }
  let kg = 0, metros = 0;
  const porRollo = new Map<string, ConsumoRollo>();
  for (const [id, v] of net) {
    const consumo = -v.c; // salida neta = consumo real
    if (consumo <= 0.001) continue;
    const u = (v.unidadDefault || '').toLowerCase();
    const r = v.rinde || 0;
    if (u.includes('kg')) { kg += consumo; metros += consumo * r; }
    else { metros += consumo; if (r > 0) kg += consumo / r; }
    porRollo.set(id, { consumo, unidadDefault: v.unidadDefault, rinde: v.rinde });
  }
  return { kg, metros, porRollo };
}

// Solo los totales (kg y metros) del consumo neto.
export function resumenConsumoTela(movs: MovConsumo[]): { kg: number; metros: number } {
  const { kg, metros } = consumoNetoPorRollo(movs);
  return { kg, metros };
}
