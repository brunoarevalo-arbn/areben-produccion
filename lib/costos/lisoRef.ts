// De qué liso sale un producto con estampa. Son dos cosas distintas:
//   · `lisoEscandalloId` → el liso tiene escandallo, así que además del liso hay COSTO.
//   · `lisoSku`          → el liso sólo existe como SKU en stock_terminado: la receta se
//                          puede declarar igual, pero no hay costo derivado.
// Antes `lisoEscandalloId` era obligatorio, o sea que declarar la receta exigía tener
// el costeo hecho. Va exactamente uno de los dos.

export interface LisoRef { lisoEscandalloId: string | null; lisoSku: string | null }

/** ¿La referencia es válida? Exactamente uno de los dos. */
export function lisoRefValida(r: LisoRef): boolean {
  return (!!r.lisoEscandalloId) !== (!!r.lisoSku);
}

/** Normaliza lo que llega por API a la forma canónica (strings vacíos → null). */
export function normalizarLisoRef(raw: { lisoEscandalloId?: unknown; lisoSku?: unknown }): LisoRef {
  const esc = typeof raw.lisoEscandalloId === 'string' && raw.lisoEscandalloId.trim() ? raw.lisoEscandalloId.trim() : null;
  const sku = typeof raw.lisoSku === 'string' && raw.lisoSku.trim() ? raw.lisoSku.trim() : null;
  return { lisoEscandalloId: esc, lisoSku: sku };
}

export const ERROR_LISO = 'Elegí el liso base: un escandallo o un SKU de liso, no los dos';

// Un solo control en la pantalla para las dos formas: el value del <option> lleva de
// qué tipo es. Así no hay dos selects que se puedan contradecir.
export function lisoValue(r: LisoRef): string {
  if (r.lisoEscandalloId) return `esc:${r.lisoEscandalloId}`;
  if (r.lisoSku) return `sku:${r.lisoSku}`;
  return '';
}

export function parseLisoValue(v: string): LisoRef {
  if (v.startsWith('esc:')) return { lisoEscandalloId: v.slice(4), lisoSku: null };
  if (v.startsWith('sku:')) return { lisoEscandalloId: null, lisoSku: v.slice(4) };
  return { lisoEscandalloId: null, lisoSku: null };
}
