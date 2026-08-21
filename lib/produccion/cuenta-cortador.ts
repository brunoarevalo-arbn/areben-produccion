import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

/**
 * Cuenta corriente del cortador. UNA sola regla, y vive acá:
 *
 *   saldo = TODOS los cortes cobrables + TODAS las muestras validadas − TODOS los pagos
 *
 * `pagoCorteId` NO entra en la cuenta: es **trazabilidad** —qué pago cubrió qué corte— y
 * vincular un corte a un pago no mueve ningún número. Antes sí entraba: la deuda eran los
 * cortes SIN imputar y sólo se restaban los pagos "a cuenta" (los que no tenían ítems). Eso
 * se rompía en cuanto se cargaba un adelanto y después se marcaban como pagados los cortes
 * que ese adelanto cubría: el adelanto seguía restando para siempre y la imputación sacaba
 * los cortes de la deuda. La misma plata dos veces. Le pasó a Fernando por $130.200.
 *
 * De acá se desprende la regla que sostiene todo: **la plata entra UNA sola vez**, por el
 * `monto` de un pago. Ningún camino puede derivar plata de los ítems tildados.
 *
 * El dueño de un pago es `PagoCorte.cortadorId` y nada más. Atarlo por sus ítems contaría
 * un pago con ítems de dos cortadores entero en las dos cuentas; los pagos sin dueño se
 * muestran aparte (`pagosSinCortador`) en vez de repartirse.
 *
 * El saldo puede quedar NEGATIVO: eso es saldo a favor del cortador, y ahora significa de
 * verdad que se le pagó de más.
 */

/** Un corte se le cobra al taller cuando tiene precio y está cargado o validado. */
export const CORTE_COBRABLE = {
  costoCorte: { gt: 0 },
  OR: [{ fichaCorteCargada: true }, { corteEstado: 'validado' }],
} as const satisfies Prisma.OrdenProduccionWhereInput;

/** Una muestra se cobra cuando está validada. */
export const MUESTRA_COBRABLE = { estado: 'validado' } as const satisfies Prisma.CorteMuestraWhereInput;

/**
 * Filtros de LISTA, no de plata: sirven para separar "lo que todavía no imputé a un pago"
 * en una pantalla. Nunca para calcular un saldo — ahí está el error que estamos sacando.
 */
export const SIN_IMPUTAR = { pagoCorteId: null } as const;
export const IMPUTADO = { pagoCorteId: { not: null } } as const;

/** Lo mínimo que hay que traer para poder decidir si un corte es cobrable. */
export const SELECT_COBRABLE = { costoCorte: true, fichaCorteCargada: true, corteEstado: true } as const;

export interface CorteCobrable {
  costoCorte: Prisma.Decimal | number;
  fichaCorteCargada: boolean;
  corteEstado: string | null;
}

/**
 * La otra punta del mismo predicado, para las pantallas que filtran en memoria. Los tres
 * campos son obligatorios a propósito: si el `select` del llamador no los trae, no compila
 * — que es lo que impide que la regla se vuelva a copiar suelta.
 */
export function esCorteCobrable(o: CorteCobrable): boolean {
  return Number(o.costoCorte) > 0 && (o.fichaCorteCargada || o.corteEstado === 'validado');
}

export interface Cuenta {
  cortes: number;   nCortes: number;
  muestras: number; nMuestras: number;
  deuda: number;
  pagos: number;    nPagos: number;
  saldo: number;
}

const CUENTA_VACIA: Cuenta = { cortes: 0, nCortes: 0, muestras: 0, nMuestras: 0, deuda: 0, pagos: 0, nPagos: 0, saldo: 0 };
const num = (d: Prisma.Decimal | number | null | undefined) => Number(d ?? 0);
const armar = (cortes: number, nCortes: number, muestras: number, nMuestras: number, pagos: number, nPagos: number): Cuenta => ({
  cortes, nCortes, muestras, nMuestras, deuda: cortes + muestras, pagos, nPagos, saldo: cortes + muestras - pagos,
});

/** La cuenta de un cortador. */
export async function cuentaDe(cortadorId: string): Promise<Cuenta> {
  const [c, m, p] = await Promise.all([
    prisma.ordenProduccion.aggregate({ where: { cortadorId, ...CORTE_COBRABLE }, _sum: { costoCorte: true }, _count: true }),
    prisma.corteMuestra.aggregate({ where: { cortadorId, ...MUESTRA_COBRABLE }, _sum: { valor: true }, _count: true }),
    prisma.pagoCorte.aggregate({ where: { cortadorId }, _sum: { montoTotal: true }, _count: true }),
  ]);
  return armar(num(c._sum.costoCorte), c._count, num(m._sum.valor), m._count, num(p._sum.montoTotal), p._count);
}

/** La cuenta de todos, para el hub y para la pantalla de pagos. */
export async function cuentaPorCortador(): Promise<Map<string, Cuenta>> {
  const [cortes, muestras, pagos] = await Promise.all([
    prisma.ordenProduccion.groupBy({ by: ['cortadorId'], where: { cortadorId: { not: null }, ...CORTE_COBRABLE }, _sum: { costoCorte: true }, _count: true }),
    prisma.corteMuestra.groupBy({ by: ['cortadorId'], where: MUESTRA_COBRABLE, _sum: { valor: true }, _count: true }),
    prisma.pagoCorte.groupBy({ by: ['cortadorId'], where: { cortadorId: { not: null } }, _sum: { montoTotal: true }, _count: true }),
  ]);

  const mapa = new Map<string, Cuenta>();
  const tocar = (id: string) => { if (!mapa.has(id)) mapa.set(id, { ...CUENTA_VACIA }); return mapa.get(id)!; };
  for (const f of cortes)   { const c = tocar(f.cortadorId!); c.cortes = num(f._sum.costoCorte); c.nCortes = f._count; }
  for (const f of muestras) { const c = tocar(f.cortadorId);  c.muestras = num(f._sum.valor);    c.nMuestras = f._count; }
  for (const f of pagos)    { const c = tocar(f.cortadorId!); c.pagos = num(f._sum.montoTotal);  c.nPagos = f._count; }
  for (const c of mapa.values()) { c.deuda = c.cortes + c.muestras; c.saldo = c.deuda - c.pagos; }
  return mapa;
}

/**
 * Pagos que no están en ninguna cuenta. Tiene que dar vacío: si un pago pierde el dueño,
 * su plata desaparece del saldo sin avisar, así que la pantalla lo muestra en vez de
 * repartirlo a ojo.
 */
export async function pagosSinCortador() {
  const filas = await prisma.pagoCorte.findMany({
    where: { cortadorId: null },
    select: { id: true, fecha: true, beneficiario: true, montoTotal: true },
    orderBy: { fecha: 'desc' },
  });
  return filas.map((p) => ({ ...p, montoTotal: num(p.montoTotal) }));
}

export interface Movimiento {
  tipo: 'corte' | 'muestra' | 'pago';
  id: string;
  fecha: Date;
  concepto: string;
  detalle: string | null;
  debe: number;
  haber: number;
  /** Sólo en cortes/muestras: la fecha del pago al que están vinculados (trazabilidad). */
  imputadoEl: Date | null;
  /** Sólo en pagos: cuántos ítems vincula. */
  nItems: number;
  saldo: number;
}

/**
 * El extracto: cortes y muestras al debe, pagos al haber, con el saldo acumulado. Va
 * ascendente por fecha, que es lo único que hace legible la columna del acumulado.
 */
export async function movimientosDe(cortadorId: string): Promise<Movimiento[]> {
  const [cortes, muestras, pagos] = await Promise.all([
    prisma.ordenProduccion.findMany({
      where: { cortadorId, ...CORTE_COBRABLE },
      select: { id: true, sku: true, descripcion: true, costoCorte: true, fechaCorte: true, createdAt: true, pagoCorte: { select: { fecha: true } } },
    }),
    prisma.corteMuestra.findMany({
      where: { cortadorId, ...MUESTRA_COBRABLE },
      select: { id: true, descripcion: true, valor: true, fecha: true, createdAt: true, pagoCorte: { select: { fecha: true } } },
    }),
    prisma.pagoCorte.findMany({
      where: { cortadorId },
      select: { id: true, fecha: true, montoTotal: true, notas: true, createdAt: true, _count: { select: { ordenes: true, muestras: true } } },
    }),
  ]);

  // Hay cortes con ficha cargada y `fechaCorte` en null: sin este fallback se apilan todos
  // al principio del extracto y el acumulado sale absurdo.
  const filas: (Movimiento & { orden: number })[] = [
    ...cortes.map((c) => ({
      tipo: 'corte' as const, id: c.id, fecha: c.fechaCorte ?? c.createdAt,
      concepto: c.sku ?? 'S/SKU', detalle: c.descripcion, debe: num(c.costoCorte), haber: 0,
      imputadoEl: c.pagoCorte?.fecha ?? null, nItems: 0, saldo: 0, orden: c.createdAt.getTime(),
    })),
    ...muestras.map((m) => ({
      tipo: 'muestra' as const, id: m.id, fecha: m.fecha,
      concepto: 'Muestra', detalle: m.descripcion, debe: num(m.valor), haber: 0,
      imputadoEl: m.pagoCorte?.fecha ?? null, nItems: 0, saldo: 0, orden: m.createdAt.getTime(),
    })),
    ...pagos.map((p) => ({
      tipo: 'pago' as const, id: p.id, fecha: p.fecha,
      concepto: 'Pago', detalle: p.notas, debe: 0, haber: num(p.montoTotal),
      imputadoEl: null, nItems: p._count.ordenes + p._count.muestras, saldo: 0, orden: p.createdAt.getTime(),
    })),
  ];

  // A igual fecha, el debe antes que el haber: si no, un pago del mismo día que el corte
  // muestra un saldo negativo que nunca existió.
  filas.sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || b.debe - a.debe || a.orden - b.orden);

  let acum = 0;
  return filas.map(({ orden: _orden, ...f }) => { acum += f.debe - f.haber; return { ...f, saldo: acum }; });
}

/**
 * Un pago sin ítems vinculados. Es sólo una ETIQUETA de pantalla: antes definía una
 * categoría aritmética ("pago a cuenta", el único que restaba) y ya no decide nada.
 */
export function esPagoSinImputar(pago: { _count: { ordenes: number; muestras: number } }) {
  return pago._count.ordenes === 0 && pago._count.muestras === 0;
}
