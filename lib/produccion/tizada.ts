// Cálculo de reparto de metros de una tizada entre sus rollos. Compartido entre el
// corte por orden (RegistrarCorteForm) y el corte por lote (CortarLoteForm).

export interface TizadaRollo {
  rolloId: string;
  metros: string;
  codigo: string;
  pesoActual: number;
  costoUnitario: number;
  rinde: number;
  nombre: string;
  // Color del rollo al momento de cortar. Se persiste en la ficha para poder validar
  // "una tizada, un color" al editarla aunque el rollo ya no exista en inventario.
  // Las fichas viejas no lo tienen: ahí el color se recupera del rollo vivo.
  color?: string | null;
}

export interface TizadaCalcInput {
  modo: 'tizada' | 'manual';
  metros: string;
  unidades: string;
  rollos: TizadaRollo[];
}

// Manual: usa los metros cargados por rollo. Tizada: deriva el rinde (m/u) de
// metros/unidades, calcula los metros necesarios para `totalUnidades` y los reparte
// rollo por rollo (hasta agotar cada uno) hasta cubrir lo necesario.
export function calcTizada(t: TizadaCalcInput, totalUnidades: number) {
  const metrosNum   = parseFloat(t.metros) || 0;
  const unidadesNum = parseInt(t.unidades) || 0;
  const metrosPorUnidad  = unidadesNum > 0 ? metrosNum / unidadesNum : 0;
  const metrosNecesarios = metrosPorUnidad * totalUnidades;
  const rollosCalc = t.rollos.map((c, i) => {
    if (t.modo === 'manual') return { ...c, metrosEf: parseFloat(c.metros) || 0 };
    const dispAntes = t.rollos.slice(0, i).reduce((s, x) => s + x.pesoActual * x.rinde, 0);
    const disp = c.pesoActual * c.rinde;
    return { ...c, metrosEf: Math.max(0, Math.min(metrosNecesarios - dispAntes, disp)) };
  });
  const totalDisp = t.rollos.reduce((s, x) => s + x.pesoActual * x.rinde, 0);
  const faltante  = t.modo === 'tizada' ? Math.max(0, metrosNecesarios - totalDisp) : 0;
  const metros = rollosCalc.reduce((s, c) => s + c.metrosEf, 0);
  const kg     = rollosCalc.reduce((s, c) => s + c.metrosEf / c.rinde, 0);
  const costo  = rollosCalc.reduce((s, c) => s + (c.metrosEf / c.rinde) * c.costoUnitario, 0);
  return { metrosPorUnidad, metrosNecesarios, rollosCalc, faltante, metros, kg, costo };
}
