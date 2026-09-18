// Costos por unidad sacados de la ficha de corte de una OP (cuando está cargada).
// Compartido por productos-producidos y por "aplicar escandallo al lote".
//
// 🔴 El divisor es lo CORTADO, no lo planificado. Hasta 81251ca `cantidad` significaba
// las dos cosas a la vez y daba igual; cuando `cantidad` pasó a ser sólo lo planificado,
// este archivo quedó como el único camino de costo unitario que seguía dividiendo por
// ella — o sea que la ficha de una OP planificada en 100 y cortada en 80 mostraba un
// costo 20% más barato acá que en `ficha-resumen`, que ya divide por lo cortado. Dos
// pantallas, dos números, la misma OP.

import { baseDeReparto } from '@/lib/produccion/cantidades';

export interface OpCostosFicha {
  fichaCorteCargada: boolean;
  costoTela: unknown;
  costoInsumosSecundarios: unknown;
  costoCorte: unknown;
  costoSublimacion?: unknown;
  cantidad: number;
  cantidadCortada: number | null;
}

/** Unidades entre las que se reparte el costo del corte, o `null` si no hay ficha. */
function base(op: OpCostosFicha): number | null {
  return op.fichaCorteCargada ? baseDeReparto(op) : null;
}

// Tela incluye los insumos secundarios del corte (badanas, hilos), como en el escandallo.
export function telaUnit(op: OpCostosFicha): number | null {
  const n = base(op);
  return n === null ? null : (Number(op.costoTela) + Number(op.costoInsumosSecundarios)) / n;
}

export function corteUnit(op: OpCostosFicha): number | null {
  const n = base(op);
  return n === null ? null : Number(op.costoCorte) / n;
}

export function sublimacionUnit(op: OpCostosFicha): number | null {
  const n = base(op);
  return n === null ? null : Number(op.costoSublimacion ?? 0) / n;
}
