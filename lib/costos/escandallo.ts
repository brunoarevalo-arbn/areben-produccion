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
}

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
  costoTelaFicha?: number;
}

export interface Margenes { margenDesarrollo: number; margenFallas: number; }

export const DATOS_VERSION = 2;
export const MEDIDAS_LAVADO_EMPTY: MedidasLavado = { largo: 0, ancho: 0, talle: '' };
export const TELA_EMPTY: Tela = { nombre: '', precioKgNeto: 0, fletePercent: 8, rindeMetrosKg: 0, consumoMetros: 0 };

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
  return {
    nombre: typeof r.nombre === 'string' ? r.nombre : '',
    precioKgNeto: num(r.precioKgNeto),
    fletePercent: num(r.fletePercent, 8),
    rindeMetrosKg: num(r.rindeMetrosKg),
    consumoMetros: num(r.consumoMetros),
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
    costoTelaFicha: typeof p.costoTelaFicha === 'number' ? p.costoTelaFicha : undefined,
  };
}

export function telaCosto(t: Tela): { pMetro: number; costo: number } {
  const pConFlete = t.precioKgNeto * (1 + t.fletePercent / 100);
  const pMetro = t.rindeMetrosKg > 0 ? pConFlete / t.rindeMetrosKg : 0;
  return { pMetro, costo: pMetro * t.consumoMetros };
}

export function calcular(d: DatosEscandallo, costoMinuto: number, margenes: Margenes) {
  const costoTelas = d.costoTelaFicha != null
    ? d.costoTelaFicha
    : d.telas.reduce((s, t) => s + telaCosto(t).costo, 0);
  const costoServicios  = d.costoCorte + d.costoTizada + d.costoLavadero;
  const costoMO         = d.tiempoConfeccion * costoMinuto;
  const costoVarios     = d.varios.reduce((s, v) => s + itemCosto(v), 0);
  const costoEmbolsado  = d.avios.tiempoEmbolsado * costoMinuto;
  const costoAvios      = d.avios.etiquetaPrincipal + d.avios.etiquetaComposicion +
    d.avios.bolsaPolipropileno + costoEmbolsado +
    d.avios.extras.reduce((s, e) => s + itemCosto(e), 0);
  const costoBase       = costoTelas + costoServicios + costoMO + costoVarios + costoAvios;
  const conDesarrollo   = costoBase * (1 + margenes.margenDesarrollo / 100);
  const costoTotal      = conDesarrollo * (1 + margenes.margenFallas / 100);
  return { costoTelas, costoServicios, costoMO, costoVarios, costoAvios, costoEmbolsado, costoBase, conDesarrollo, costoTotal };
}
