// Fuente única de verdad del escandallo: tipos del JSON `datos`, parser
// versionado (migra formas viejas al leer) y cálculo de costos. Lo consumen
// tanto el editor (components/costos/Escandallos.tsx) como la ficha PDF
// (app/(dashboard)/costos/escandallos/[id]/page.tsx) para que no diverjan.

export interface Tela {
  nombre: string;
  precioKgNeto: number;
  fletePercent: number;
  rindeMetrosKg: number;
  consumoMetros: number;
  // Modo tira (ribete / tapacostura): tela cortada en tira con la cortacollaretas.
  // El consumo se mide por área (ancho×largo) y suma merma por las uniones del tubo.
  tipo?: 'tela' | 'tira';
  anchoTelaM?: number;    // ancho del rollo en METROS — para pasar kg → m²
  anchoTiraCm?: number;   // ancho de la tira cortada
  largoTiraCm?: number;   // largo de una tira/pieza por prenda
  largoVueltaCm?: number; // largo de tira por vuelta del tubo (entre uniones)
  descarteUnionCm?: number; // cm que se pierden por la costura de cada unión (merma fija)
  mermaPercent?: number;  // % desperdicio total (fija + empaque), calculado o manual
  // Marca que la merma la MIDIÓ una corrida (secuencia real de cortes del tubo),
  // no la calculó la fórmula. Con esto en true el editor deja de recalcularla al
  // tocar los largos: una fórmula no le pasa por encima a una medición.
  mermaMedida?: boolean;
  curva?: TiraCurva;      // el largo por TALLE (el ribete es lo que más escala con el talle)
}

/**
 * Curva de largo de una tira por talle. Se mide UN talle (el que cosió la
 * costurera en la corrida de muestra) y el resto se deriva por escalón: +% o
 * +cm. Un talle con `manual: true` fue pisado a mano y no se recalcula nunca.
 */
export interface TiraCurva {
  talleBase: string;
  pasoPercent?: number;   // +% por escalón   (se usa uno de los dos)
  pasoCm?: number;        // o +cm por escalón
  talles: TalleLargo[];
}

export interface TalleLargo { talle: string; largoCm: number; manual?: boolean }

/** Con qué peso entra cada talle al costo por prenda. Sin mezcla, todos pesan 1. */
export interface MezclaTalle { talle: string; peso: number }

// Ítem con cantidad: el costo es cantidad × costoUnitario. Reemplaza al viejo
// { nombre, costo } (que equivale a cantidad 1). parseDatos migra los viejos.
export interface ItemExtra {
  nombre: string;
  cantidad: number;
  costoUnitario: number;
}

export interface MedidasLavado { largo: number; ancho: number; talle: string; }

export interface AviosData {
  etiquetaPrincipal: number;
  etiquetaComposicion: number;
  etiquetaPrincipalId?: string | null;   // ref al EtiquetaCatalogo elegido (traza)
  etiquetaComposicionId?: string | null;
  bolsaPolipropileno: number;
  tiempoEmbolsado: number;
  extras: ItemExtra[];
}

export interface DatosEscandallo {
  version?: number;
  telas: Tela[];
  costoCorte: number;
  costoTizada: number;
  costoLavadero: number;
  tiempoConfeccion: number;
  varios: ItemExtra[];
  avios: AviosData;
  medidasPreLavado?: MedidasLavado;
  medidasPostLavado?: MedidasLavado;
  margenDesarrollo: number;
  margenFallas: number;
  mezclaTalles?: MezclaTalle[];
  costoTelaFicha?: number;
  costoCorteFicha?: number; // costo de corte por prenda traído de la ficha (un solo corte por SKU)
  costoAviosFicha?: number; // costo de avíos por prenda traído de la ficha (bloquea la carga manual)
  costoSublimacionFicha?: number; // costo de sublimación por prenda traído de la ficha
}

export interface Margenes { margenDesarrollo: number; margenFallas: number; }

export const DATOS_VERSION = 4;
export const MEDIDAS_LAVADO_EMPTY: MedidasLavado = { largo: 0, ancho: 0, talle: '' };
export const TELA_EMPTY: Tela = { nombre: '', precioKgNeto: 0, fletePercent: 8, rindeMetrosKg: 0, consumoMetros: 0, tipo: 'tela' };
export const TIRA_EMPTY: Tela = { nombre: '', precioKgNeto: 0, fletePercent: 8, rindeMetrosKg: 0, consumoMetros: 0, tipo: 'tira', anchoTelaM: 0, anchoTiraCm: 0, largoTiraCm: 0, largoVueltaCm: 0, descarteUnionCm: 0, mermaPercent: 0 };

/**
 * Merma de la tira = suma de dos mermas por cada "vuelta" (tramo entre uniones):
 *  - fija: el pedazo que se descarta por la costura de la unión (descarteUnionCm).
 *  - empaque: lo que sobra sin completar otra tira entera (largoVuelta mod largoPieza).
 */
export function mermaPorVuelta(largoPiezaCm: number, largoVueltaCm: number, descarteUnionCm = 0): number {
  if (!largoVueltaCm || largoVueltaCm <= 0) return 0;
  const fija = descarteUnionCm / largoVueltaCm;
  const empaque = largoPiezaCm > 0 ? (largoVueltaCm % largoPiezaCm) / largoVueltaCm : 0;
  return Math.min(100, (fija + empaque) * 100);
}

/**
 * Deriva el largo de cada talle a partir del talle base y el escalón. Los talles
 * marcados `manual` quedan intactos: alguien los midió o los corrigió, y una
 * regla no pisa una medición.
 */
export function escalarCurva(curva: TiraCurva, largoBase: number): TiraCurva {
  const i0 = curva.talles.findIndex((t) => t.talle === curva.talleBase);
  if (i0 < 0) return curva;
  const talles = curva.talles.map((t, i) => {
    if (t.manual) return t;
    const d = i - i0;
    const largo = curva.pasoCm != null && curva.pasoCm !== 0
      ? largoBase + curva.pasoCm * d
      : largoBase * Math.pow(1 + (curva.pasoPercent ?? 0) / 100, d);
    return { ...t, largoCm: Math.round(Math.max(0, largo) * 10) / 10 };
  });
  return { ...curva, talles };
}

export const DEFAULT_DATOS: DatosEscandallo = {
  version: DATOS_VERSION,
  telas: [{ ...TELA_EMPTY }],
  costoCorte: 0, costoTizada: 0, costoLavadero: 0, tiempoConfeccion: 0,
  varios: [],
  avios: { etiquetaPrincipal: 0, etiquetaComposicion: 0, bolsaPolipropileno: 0, tiempoEmbolsado: 0, extras: [] },
  medidasPreLavado:  { ...MEDIDAS_LAVADO_EMPTY },
  medidasPostLavado: { ...MEDIDAS_LAVADO_EMPTY },
  margenDesarrollo: 10, margenFallas: 5,
};

export function deepClone<T>(o: T): T { return JSON.parse(JSON.stringify(o)); }

export function itemCosto(it: ItemExtra): number {
  return (it.cantidad || 0) * (it.costoUnitario || 0);
}

function num(v: unknown, def = 0): number {
  return typeof v === 'number' && !Number.isNaN(v) ? v : def;
}

// Migra un ítem viejo { nombre, costo } al nuevo { nombre, cantidad, costoUnitario }.
function migrarItem(raw: unknown): ItemExtra {
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    const nombre = typeof r.nombre === 'string' ? r.nombre : '';
    if (typeof r.costoUnitario === 'number') {
      return { nombre, cantidad: num(r.cantidad, 1) || 1, costoUnitario: num(r.costoUnitario) };
    }
    if (typeof r.costo === 'number') {
      return { nombre, cantidad: 1, costoUnitario: num(r.costo) };
    }
    return { nombre, cantidad: 1, costoUnitario: 0 };
  }
  return { nombre: '', cantidad: 1, costoUnitario: 0 };
}

function migrarTela(raw: unknown): Tela {
  const r = (raw ?? {}) as Record<string, unknown>;
  const tipo = r.tipo === 'tira' ? 'tira' : 'tela';
  return {
    nombre: typeof r.nombre === 'string' ? r.nombre : '',
    precioKgNeto: num(r.precioKgNeto),
    fletePercent: num(r.fletePercent, 8),
    rindeMetrosKg: num(r.rindeMetrosKg),
    consumoMetros: num(r.consumoMetros),
    tipo,
    ...(tipo === 'tira' ? {
      anchoTelaM: num(r.anchoTelaM, r.anchoTelaCm != null ? num(r.anchoTelaCm) / 100 : 0),
      anchoTiraCm: num(r.anchoTiraCm),
      largoTiraCm: num(r.largoTiraCm),
      largoVueltaCm: num(r.largoVueltaCm),
      descarteUnionCm: num(r.descarteUnionCm),
      mermaPercent: num(r.mermaPercent),
      ...(r.mermaMedida === true ? { mermaMedida: true } : {}),
      ...(r.curva ? { curva: migrarCurva(r.curva) } : {}),
    } : {}),
  };
}

function migrarCurva(raw: unknown): TiraCurva | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const talles = Array.isArray(r.talles)
    ? r.talles.map((t) => {
        const x = (t ?? {}) as Record<string, unknown>;
        return {
          talle: typeof x.talle === 'string' ? x.talle : '',
          largoCm: num(x.largoCm),
          ...(x.manual === true ? { manual: true } : {}),
        };
      }).filter((t) => t.talle !== '')
    : [];
  if (talles.length === 0) return undefined;
  return {
    talleBase: typeof r.talleBase === 'string' ? r.talleBase : talles[0].talle,
    ...(typeof r.pasoCm === 'number' ? { pasoCm: r.pasoCm } : {}),
    ...(typeof r.pasoPercent === 'number' ? { pasoPercent: r.pasoPercent } : {}),
    talles,
  };
}

function migrarMedidas(raw: unknown): MedidasLavado {
  const r = (raw ?? {}) as Record<string, unknown>;
  return { largo: num(r.largo), ancho: num(r.ancho), talle: typeof r.talle === 'string' ? r.talle : '' };
}

/** Parsea el JSON `datos` de un escandallo, migrando formas viejas. Nunca tira. */
export function parseDatos(raw: string | null | undefined): DatosEscandallo {
  if (!raw) return deepClone(DEFAULT_DATOS);
  let p: Record<string, unknown>;
  try { p = JSON.parse(raw) as Record<string, unknown>; } catch { return deepClone(DEFAULT_DATOS); }

  const aviosRaw = (p.avios ?? {}) as Record<string, unknown>;
  return {
    version: DATOS_VERSION,
    telas: Array.isArray(p.telas) ? p.telas.map(migrarTela) : [],
    costoCorte: num(p.costoCorte),
    costoTizada: num(p.costoTizada),
    costoLavadero: num(p.costoLavadero),
    tiempoConfeccion: num(p.tiempoConfeccion),
    varios: Array.isArray(p.varios) ? p.varios.map(migrarItem) : [],
    avios: {
      etiquetaPrincipal: num(aviosRaw.etiquetaPrincipal),
      etiquetaComposicion: num(aviosRaw.etiquetaComposicion),
      etiquetaPrincipalId: (aviosRaw.etiquetaPrincipalId as string) ?? null,
      etiquetaComposicionId: (aviosRaw.etiquetaComposicionId as string) ?? null,
      bolsaPolipropileno: num(aviosRaw.bolsaPolipropileno),
      tiempoEmbolsado: num(aviosRaw.tiempoEmbolsado),
      extras: Array.isArray(aviosRaw.extras) ? aviosRaw.extras.map(migrarItem) : [],
    },
    medidasPreLavado: migrarMedidas(p.medidasPreLavado),
    medidasPostLavado: migrarMedidas(p.medidasPostLavado),
    margenDesarrollo: num(p.margenDesarrollo, 10),
    margenFallas: num(p.margenFallas, 5),
    ...(Array.isArray(p.mezclaTalles) && p.mezclaTalles.length > 0
      ? { mezclaTalles: p.mezclaTalles.map((m) => {
          const x = (m ?? {}) as Record<string, unknown>;
          return { talle: typeof x.talle === 'string' ? x.talle : '', peso: num(x.peso, 1) };
        }).filter((m) => m.talle !== '') }
      : {}),
    costoTelaFicha: typeof p.costoTelaFicha === 'number' ? p.costoTelaFicha : undefined,
    costoCorteFicha: typeof p.costoCorteFicha === 'number' ? p.costoCorteFicha : undefined,
    costoAviosFicha: typeof p.costoAviosFicha === 'number' ? p.costoAviosFicha : undefined,
    costoSublimacionFicha: typeof p.costoSublimacionFicha === 'number' ? p.costoSublimacionFicha : undefined,
  };
}

export interface FilaTalle {
  talle: string; largoCm: number; merma: number; costo: number; peso: number; manual: boolean;
}

/** $/m² de una tira: el $/kg con flete, pasado a área por el rinde y el ancho del rollo. */
export function precioM2(t: Tela): number {
  const pConFlete = t.precioKgNeto * (1 + t.fletePercent / 100);
  const m2Kg = t.rindeMetrosKg * (t.anchoTelaM ?? 0);
  return m2Kg > 0 ? pConFlete / m2Kg : 0;
}

/**
 * El costo de la tira EN CADA TALLE de su curva. Vacío si la tira no tiene curva.
 *
 * ⚠️ La merma se recalcula por talle: la parte de empaque
 * (`largoVuelta % largoPieza`) depende del largo, así que es distinta en cada
 * uno. Por eso el promedio se hace sobre los COSTOS y no sobre los cm — promediar
 * los largos primero da un número que existe pero no significa.
 */
export function tiraPorTalle(t: Tela, mezcla?: MezclaTalle[]): FilaTalle[] {
  if (t.tipo !== 'tira' || !t.curva || t.curva.talles.length === 0) return [];
  const pM2 = precioM2(t);
  const anchoTira = (t.anchoTiraCm ?? 0) / 100;
  const largoVuelta = t.largoVueltaCm ?? 0;
  return t.curva.talles.map((x) => {
    // Con merma MEDIDA no se recalcula por talle: el desperdicio se midió sobre
    // el tubo entero, no sobre una pieza — y una fórmula no le pasa por encima a
    // una medición. Sin medición, sí vale derivarla del largo de cada talle.
    const merma = t.mermaMedida || largoVuelta <= 0
      ? (t.mermaPercent ?? 0)
      : mermaPorVuelta(x.largoCm, largoVuelta, t.descarteUnionCm ?? 0);
    const costo = pM2 * ((x.largoCm / 100) * anchoTira) * (1 + merma / 100);
    const peso = mezcla?.find((m) => m.talle === x.talle)?.peso ?? 1;
    return { talle: x.talle, largoCm: x.largoCm, merma, costo, peso, manual: x.manual === true };
  });
}

export function telaCosto(t: Tela, mezcla?: MezclaTalle[]): { pMetro: number; pM2: number; costo: number; merma: number } {
  const pConFlete = t.precioKgNeto * (1 + t.fletePercent / 100);
  if (t.tipo === 'tira') {
    const anchoTela = t.anchoTelaM ?? 0;          // ya está en metros
    const anchoTira = (t.anchoTiraCm ?? 0) / 100;
    const largoTira = (t.largoTiraCm ?? 0) / 100;
    const m2Kg = t.rindeMetrosKg * anchoTela;      // m² por kg
    const pM2 = m2Kg > 0 ? pConFlete / m2Kg : 0;   // $/m²

    // Con curva de talles, el costo por prenda es el ponderado de los talles.
    // Sin curva se cae al camino de siempre: un escandallo viejo no se mueve.
    const filas = tiraPorTalle(t, mezcla);
    if (filas.length > 0) {
      const pesoTotal = filas.reduce((s, f) => s + f.peso, 0);
      if (pesoTotal > 0) {
        const costo = filas.reduce((s, f) => s + f.costo * f.peso, 0) / pesoTotal;
        const merma = filas.reduce((s, f) => s + f.merma * f.peso, 0) / pesoTotal;
        return { pMetro: 0, pM2, costo, merma };
      }
    }

    const merma = t.mermaPercent ?? 0;
    const costo = pM2 * (largoTira * anchoTira) * (1 + merma / 100);
    return { pMetro: 0, pM2, costo, merma };
  }
  const pMetro = t.rindeMetrosKg > 0 ? pConFlete / t.rindeMetrosKg : 0;
  return { pMetro, pM2: 0, costo: pMetro * t.consumoMetros, merma: 0 };
}

export function calcular(d: DatosEscandallo, costoMinuto: number, margenes: Margenes) {
  const costoTelas = d.costoTelaFicha != null
    ? d.costoTelaFicha
    : d.telas.reduce((s, t) => s + telaCosto(t, d.mezclaTalles).costo, 0);
  // La sublimación solo viene de la ficha real (no hay carga manual): es un servicio más.
  const costoServicios  = d.costoCorte + d.costoTizada + d.costoLavadero + (d.costoSublimacionFicha ?? 0);
  const costoMO         = d.tiempoConfeccion * costoMinuto;
  const costoVarios     = d.varios.reduce((s, v) => s + itemCosto(v), 0);
  const costoEmbolsado  = d.avios.tiempoEmbolsado * costoMinuto;
  // Si la ficha trae avíos, su costo reemplaza los materiales manuales (etiquetas/bolsa/extras);
  // el embolsado (mano de obra) se suma siempre.
  const costoAviosMat   = d.costoAviosFicha != null
    ? d.costoAviosFicha
    : d.avios.etiquetaPrincipal + d.avios.etiquetaComposicion + d.avios.bolsaPolipropileno +
      d.avios.extras.reduce((s, e) => s + itemCosto(e), 0);
  const costoAvios      = costoAviosMat + costoEmbolsado;
  const costoBase       = costoTelas + costoServicios + costoMO + costoVarios + costoAvios;
  const conDesarrollo   = costoBase * (1 + margenes.margenDesarrollo / 100);
  const costoTotal      = conDesarrollo * (1 + margenes.margenFallas / 100);
  return { costoTelas, costoServicios, costoMO, costoVarios, costoAvios, costoEmbolsado, costoBase, conDesarrollo, costoTotal };
}
