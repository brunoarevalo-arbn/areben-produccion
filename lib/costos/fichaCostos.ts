// Costos por unidad sacados de la ficha de corte de una OP (cuando está cargada).
// Compartido por productos-producidos y por "aplicar escandallo al lote".

export interface OpCostosFicha {
  fichaCorteCargada: boolean;
  costoTela: unknown;
  costoInsumosSecundarios: unknown;
  costoCorte: unknown;
  costoSublimacion?: unknown;
  cantidad: number;
}

// Tela incluye los insumos secundarios del corte (badanas, hilos), como en el escandallo.
export function telaUnit(op: OpCostosFicha): number | null {
  return op.fichaCorteCargada && op.cantidad > 0
    ? (Number(op.costoTela) + Number(op.costoInsumosSecundarios)) / op.cantidad
    : null;
}

export function corteUnit(op: OpCostosFicha): number | null {
  return op.fichaCorteCargada && op.cantidad > 0 ? Number(op.costoCorte) / op.cantidad : null;
}

export function sublimacionUnit(op: OpCostosFicha): number | null {
  return op.fichaCorteCargada && op.cantidad > 0 ? Number(op.costoSublimacion ?? 0) / op.cantidad : null;
}
