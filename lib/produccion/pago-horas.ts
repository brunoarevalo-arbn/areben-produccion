// Pago de horas de una costurera. Dueño único de la regla: la pantalla y la API sólo llaman acá.
//
// La regla del día (Bruno, 24-oct): se mide la PRESENCIA (primera entrada → última salida, con el
// almuerzo adentro: así pagó él, 28-sep al 9-oct = 72,0 h × $6.000 exacto; descontándolo daba 65 h)
// y se compara con la jornada. `descuentaPausas` queda como opción para otra costurera. Si faltan hasta `toleranciaMin` minutos, se paga la JORNADA COMPLETA;
// si falta más (se fue antes), se paga lo trabajado redondeado a fracciones de `fraccionMin`.
// Lo que pasa de la jornada es extra y lleva `recargoExtraPct`.
//
// ⚠️ No importa `prisma` a propósito: es pura, se prueba con `prisma/check-pago-horas.ts` y
// podría usarla un 'use client'.
import { minutosEntre, horaASegundos } from '@/lib/tiempos/minutos';

export type Redondeo = 'ABAJO' | 'CERCANO' | 'ARRIBA';
export type Periodo = 'SEMANAL' | 'QUINCENAL' | 'MENSUAL';

export interface ConfigPago {
  jornadaMin: number;
  toleranciaMin: number;
  fraccionMin: number;
  redondeo: Redondeo;
  descuentaPausas: boolean;
  recargoExtraPct: number;
  periodo: Periodo;
  anclaPeriodo: string | null;
  /** 0 = domingo … 6 = sábado. */
  diasSemana: number[];
}

export const CONFIG_DEFECTO: ConfigPago = {
  jornadaMin: 540, toleranciaMin: 29, fraccionMin: 30, redondeo: 'CERCANO',
  descuentaPausas: false, recargoExtraPct: 0, periodo: 'QUINCENAL', anclaPeriodo: null,
  diasSemana: [1, 2, 3, 4, 5],
};

/** Actividades que NO son trabajo: se descuentan del tramo entrada→salida. */
export const PAUSAS = ['Almuerzo', 'Descanso'];

export interface Registro {
  fecha: string; // YYYY-MM-DD
  actividad: string;
  horaInicio: string | null;
  horaFin: string | null;
  minutosNetos: number;
}

export interface TarifaVigente { desde: string; montoHora: number }

export type Motivo = 'tolerancia' | 'real' | 'extra' | 'ajuste' | 'sin_registros' | 'dia_no_laboral';

export interface DiaPago {
  fecha: string;
  entrada: string | null;
  salida: string | null;
  tramoMin: number;
  pausasMin: number;
  trabajadoMin: number;
  pagadoMin: number;
  extraMin: number;
  tarifa: number;
  monto: number;
  motivo: Motivo;
  nota?: string | null;
}

export interface ResultadoPeriodo {
  desde: string;
  hasta: string;
  dias: DiaPago[];
  totalMin: number;
  totalMonto: number;
  /** Días del período sin tarifa cargada: el monto de esos días es 0 y la pantalla lo avisa. */
  diasSinTarifa: number;
}

// ── Fechas (YYYY-MM-DD, siempre en UTC: no hay hora, es un día de calendario) ──────────────
const aDate = (f: string) => new Date(`${f}T00:00:00Z`);
const aStr = (d: Date) => d.toISOString().slice(0, 10);
export const sumarDias = (f: string, n: number) => { const d = aDate(f); d.setUTCDate(d.getUTCDate() + n); return aStr(d); };
const diaSemana = (f: string) => aDate(f).getUTCDay();

/** Cada día entre `desde` y `hasta`, ambos inclusive. */
export function diasEntre(desde: string, hasta: string): string[] {
  const out: string[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) out.push(f);
  return out;
}

/** El período que contiene a `ref`. QUINCENAL son bloques de 14 días contados desde el ancla. */
export function periodoDe(periodo: Periodo, ref: string, ancla: string | null): { desde: string; hasta: string } {
  if (periodo === 'MENSUAL') {
    const d = aDate(ref);
    const ini = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const fin = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    return { desde: aStr(ini), hasta: aStr(fin) };
  }
  if (periodo === 'SEMANAL') {
    const lunes = sumarDias(ref, -((diaSemana(ref) + 6) % 7));
    return { desde: lunes, hasta: sumarDias(lunes, 6) };
  }
  // QUINCENAL: sin ancla no hay forma de saber en qué mitad cae ⇒ no se inventa, se usa lunes.
  const base = ancla ?? sumarDias(ref, -((diaSemana(ref) + 6) % 7));
  const dif = Math.round((aDate(ref).getTime() - aDate(base).getTime()) / 86400000);
  const desde = sumarDias(base, Math.floor(dif / 14) * 14);
  return { desde, hasta: sumarDias(desde, 13) };
}

/** El período anterior (`-1`) o siguiente (`+1`) a uno dado. */
export function periodoVecino(periodo: Periodo, actual: { desde: string; hasta: string }, ancla: string | null, paso: 1 | -1) {
  return periodoDe(periodo, paso === 1 ? sumarDias(actual.hasta, 1) : sumarDias(actual.desde, -1), ancla);
}

// ── Redondeo ────────────────────────────────────────────────────────────────────────────────
export function redondear(min: number, fraccion: number, modo: Redondeo): number {
  if (fraccion <= 0) return Math.round(min);
  const f = min / fraccion;
  const n = modo === 'ABAJO' ? Math.floor(f + 1e-9) : modo === 'ARRIBA' ? Math.ceil(f - 1e-9) : Math.round(f);
  return n * fraccion;
}

/** La tarifa que regía ese día: la última cuyo `desde` es ≤ fecha. */
export function tarifaDelDia(tarifas: TarifaVigente[], fecha: string): number | null {
  let mejor: TarifaVigente | null = null;
  for (const t of tarifas) if (t.desde <= fecha && (!mejor || t.desde > mejor.desde)) mejor = t;
  return mejor ? mejor.montoHora : null;
}

// ── El día ──────────────────────────────────────────────────────────────────────────────────
export function calcularDia(
  cfg: ConfigPago, fecha: string, regs: Registro[], tarifa: number | null, ajusteMin?: { minutos: number; nota?: string | null } | null,
): DiaPago {
  const h = (min: number) => (tarifa ?? 0) * (min / 60);
  const base = { fecha, entrada: null, salida: null, tramoMin: 0, pausasMin: 0, trabajadoMin: 0, pagadoMin: 0, extraMin: 0, tarifa: tarifa ?? 0, monto: 0 };

  if (ajusteMin) {
    return { ...base, pagadoMin: ajusteMin.minutos, monto: h(ajusteMin.minutos), motivo: 'ajuste', nota: ajusteMin.nota ?? null };
  }
  if (!cfg.diasSemana.includes(diaSemana(fecha))) return { ...base, motivo: 'dia_no_laboral' };
  if (regs.length === 0) return { ...base, motivo: 'sin_registros' };

  const conHora = regs.filter((r) => r.horaInicio && r.horaFin);
  const pausasMin = regs.filter((r) => PAUSAS.includes(r.actividad)).reduce((a, r) => a + r.minutosNetos, 0);
  let entrada: string | null = null, salida: string | null = null, tramoMin: number;
  if (conHora.length) {
    entrada = conHora.reduce((m, r) => (horaASegundos(r.horaInicio!) < horaASegundos(m) ? r.horaInicio! : m), conHora[0].horaInicio!);
    salida = conHora.reduce((m, r) => (horaASegundos(r.horaFin!) > horaASegundos(m) ? r.horaFin! : m), conHora[0].horaFin!);
    tramoMin = minutosEntre(entrada, salida);
  } else {
    // Registros cargados a mano sin horario: lo único que hay son sus minutos.
    tramoMin = regs.reduce((a, r) => a + r.minutosNetos, 0);
  }
  const trabajadoMin = Math.max(0, tramoMin - (cfg.descuentaPausas && conHora.length ? pausasMin : 0));

  let pagadoMin: number, extraMin = 0, motivo: Motivo;
  const falta = cfg.jornadaMin - trabajadoMin;
  if (falta <= cfg.toleranciaMin && falta >= 0) {
    pagadoMin = cfg.jornadaMin; motivo = 'tolerancia';
  } else if (falta < 0) {
    // Pasó la jornada: la jornada a tarifa simple y el resto, en fracciones, con recargo.
    extraMin = redondear(-falta, cfg.fraccionMin, cfg.redondeo);
    pagadoMin = cfg.jornadaMin + extraMin; motivo = 'extra';
  } else {
    pagadoMin = redondear(trabajadoMin, cfg.fraccionMin, cfg.redondeo); motivo = 'real';
  }
  const monto = h(pagadoMin - extraMin) + h(extraMin) * (1 + cfg.recargoExtraPct / 100);
  return { fecha, entrada, salida, tramoMin, pausasMin, trabajadoMin, pagadoMin, extraMin, tarifa: tarifa ?? 0, monto, motivo };
}

/** Todo el período: un `DiaPago` por día laboral con registros, más ajustes manuales. */
export function calcularPeriodo(
  cfg: ConfigPago, tarifas: TarifaVigente[], registros: Registro[], desde: string, hasta: string,
  ajustes: { fecha: string; minutos: number; nota?: string | null }[] = [],
): ResultadoPeriodo {
  const porDia = new Map<string, Registro[]>();
  for (const r of registros) { if (r.fecha >= desde && r.fecha <= hasta) porDia.set(r.fecha, [...(porDia.get(r.fecha) ?? []), r]); }
  const aj = new Map(ajustes.map((a) => [a.fecha, a]));
  const dias: DiaPago[] = [];
  let diasSinTarifa = 0;
  for (const f of diasEntre(desde, hasta)) {
    const d = calcularDia(cfg, f, porDia.get(f) ?? [], tarifaDelDia(tarifas, f), aj.get(f));
    // Los días sin nada que mostrar ni pagar no ensucian la tabla.
    if (d.motivo === 'dia_no_laboral' && d.pagadoMin === 0) continue;
    if (d.pagadoMin > 0 && tarifaDelDia(tarifas, f) === null) diasSinTarifa++;
    dias.push(d);
  }
  return {
    desde, hasta, dias, diasSinTarifa,
    totalMin: dias.reduce((a, d) => a + d.pagadoMin, 0),
    totalMonto: dias.reduce((a, d) => a + d.monto, 0),
  };
}
