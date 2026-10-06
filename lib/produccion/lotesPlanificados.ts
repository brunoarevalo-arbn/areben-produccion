// Lotes PLANIFICADOS: separar un corte en "Lote 1 / Lote 2" ANTES de ingresarlo.
//
// 🔑 El caso que lo trajo (6-oct-2026): la AYLA negra se cortó entera (62) y en el taller
// hubo que separar 20 (S10 · M10) después del remallado. Va a seguir pasando, y en
// cualquier punto: al planificar, con todo cortado, o después de un proceso completo.
// Hace falta para dos cosas: etiquetar las bolsas ("Lote 2 de 2") y que la tablet le
// marque los minutos a cada lote — si no, el primero que ingresa se lleva todo.
//
// ⚠️ Un lote planificado NO es un `LoteCorte` (lo que ya entró al stock, con su costo
// congelado) ni un `LoteProduccion` (la tizada de varios colores). Una orden que nunca
// se separó no tiene filas acá y funciona exactamente como antes.
//
// 🔑 Se separa siempre DEL LOTE 1: al separar por primera vez el Lote 1 nace con todo lo
// cortado por talle, y cada separación le saca lo suyo. La cantidad cortada de la orden
// (y con ella el pago al cortador) no se toca nunca.
import type { Prisma, PrismaClient } from '@prisma/client';
import type { SessionPayload } from '@/lib/session';
import { DESPUES_DE_LOTE_1, ordenarTalles, textoTalles } from '@/lib/constants/lotes';
import { cantidadCortada, tallesCortados } from './cantidades';
import { partesDeOrden } from './conjuntos';
import type { LotePlanParaCostear } from './loteCorte';

type Db = PrismaClient | Prisma.TransactionClient;

export class LotePlanificadoError extends Error {}

export interface TalleConteo { talle: string; cantidad: number }

export interface EstadoLote {
  id: string;
  numero: number;
  despuesDe: string;
  separadoAt: Date;
  separadoPor: string;
  talles: TalleConteo[];
  unidades: number;
  /** Ingresado por pieza (`''` si la prenda no se parte) y talle. */
  ingresadoPorParte: Map<string, Map<string, number>>;
  /** Lo ingresado en unidades del corte: la pieza que MENOS entró (ver `cantidadIngresadaPorPartes`). */
  ingresado: number;
  /** Por talle, lo que todavía no entró de NINGUNA pieza: lo único que se puede mover a otro lote. */
  sinIngresar: TalleConteo[];
  abierto: boolean;
}

/**
 * Los lotes planificados de la orden con lo que ya entró de cada uno. `[]` = la orden no
 * está separada.
 */
export async function estadoDeLotes(db: Db, orden: { id: string; sku: string | null }): Promise<EstadoLote[]> {
  const lotes = await db.lotePlanificado.findMany({
    where: { ordenId: orden.id },
    orderBy: { numero: 'asc' },
    include: { talles: true, ingresos: { include: { talles: true } } },
  });
  if (lotes.length === 0) return [];

  const partes = (await partesDeOrden(db, orden.sku)).map((p) => p.nombre);
  const claves = partes.length > 0 ? partes : [''];

  return lotes.map((l) => {
    const ingresadoPorParte = new Map<string, Map<string, number>>(claves.map((k) => [k, new Map()]));
    for (const ing of l.ingresos) {
      const m = ingresadoPorParte.get(ing.parte ?? '');
      if (!m) continue; // una pieza que hoy no está en el catálogo: no se puede afirmar de cuál es
      for (const t of ing.talles) m.set(t.talle, (m.get(t.talle) ?? 0) + t.cantidad);
    }
    const talles = ordenarTalles(l.talles.map((t) => ({ talle: t.talle, cantidad: t.cantidad })));
    const unidades = talles.reduce((s, t) => s + t.cantidad, 0);
    const totalDe = (k: string) => [...(ingresadoPorParte.get(k)?.values() ?? [])].reduce((s, n) => s + n, 0);
    const ingresado = Math.min(...claves.map(totalDe));
    const sinIngresar = talles.map((t) => ({
      talle: t.talle,
      cantidad: Math.max(0, t.cantidad - Math.max(...claves.map((k) => ingresadoPorParte.get(k)?.get(t.talle) ?? 0))),
    }));
    return {
      id: l.id, numero: l.numero, despuesDe: l.despuesDe, separadoAt: l.separadoAt, separadoPor: l.separadoPor,
      talles, unidades, ingresadoPorParte, ingresado, sinIngresar, abierto: ingresado < unidades,
    };
  });
}

/** Lo que necesita `loteCorte.ts` para costear un ingreso del lote `numero`. */
export function lotePlanParaCostear(lotes: EstadoLote[], loteId: string): LotePlanParaCostear | null {
  const lote = lotes.find((l) => l.id === loteId);
  if (!lote) return null;
  return {
    id: lote.id,
    numero: lote.numero,
    unidades: lote.unidades,
    unidadesTotales: lotes.reduce((s, l) => s + l.unidades, 0),
    numeros: lotes.map((l) => l.numero),
  };
}

/**
 * Controla que lo que entra en un ingreso entre en el lote: por pieza y por talle, no más
 * de lo que a ese lote le falta. Devuelve el texto del error, o `null`.
 *
 * 🔴 Por pieza y no en total: 16 corpiños S y 0 bombachas S ya entraron, y la bombacha S
 * todavía tiene sus 16 para entrar aunque el corpiño no tenga ninguno.
 */
export function excesoSobreLote(lote: EstadoLote, conteos: { parte: string | null; talles: TalleConteo[] }[]): string | null {
  const plan = new Map(lote.talles.map((t) => [t.talle, t.cantidad]));
  for (const c of conteos) {
    const ya = lote.ingresadoPorParte.get(c.parte ?? '') ?? new Map<string, number>();
    for (const t of c.talles) {
      if (t.cantidad <= 0) continue;
      const queda = (plan.get(t.talle) ?? 0) - (ya.get(t.talle) ?? 0);
      if (t.cantidad > queda) {
        return `El Lote ${lote.numero} ${c.parte ? `(${c.parte}) ` : ''}tiene ${Math.max(0, queda)} de talle ${t.talle} ` +
          `para ingresar y el conteo dice ${t.cantidad}. Si salieron de otro lote, ingresalas en ese.`;
      }
    }
  }
  return null;
}

/**
 * Separa un lote nuevo del Lote 1. La primera vez arma el Lote 1 con todo lo cortado.
 *
 * 🔴 Se planta si los talles del corte no suman lo cortado: el reparto de los minutos
 * comunes es por unidades planificadas, y unos talles que suman 60 sobre 62 cortadas
 * repartirían sobre un número que nadie cortó.
 */
export async function separarLote(
  tx: Prisma.TransactionClient,
  ordenId: string,
  tallesInput: TalleConteo[],
  despuesDe: string,
  session: SessionPayload,
): Promise<EstadoLote[]> {
  const orden = await tx.ordenProduccion.findUnique({ where: { id: ordenId }, include: { cortesPorTalle: true } });
  if (!orden) throw new LotePlanificadoError('OP no encontrada');
  if (orden.estado !== 'COSTURA') {
    throw new LotePlanificadoError(`La OP ${orden.sku ?? ordenId} no está en costura: los lotes se separan mientras se cose`);
  }

  const talles = tallesInput.filter((t) => t.cantidad > 0);
  if (talles.length === 0) throw new LotePlanificadoError('Cargá cuántas van al lote nuevo en al menos un talle');
  if (new Set(talles.map((t) => t.talle)).size !== talles.length) throw new LotePlanificadoError('Hay talles repetidos');

  let lotes = await estadoDeLotes(tx, orden);
  if (lotes.length === 0) {
    const cortado = tallesCortados(orden);
    if (!cortado) {
      throw new LotePlanificadoError(
        `${orden.sku ?? 'La OP'} no tiene cargado cuánto se cortó por talle: cargá la ficha de corte antes de separar lotes.`,
      );
    }
    const suma = cortado.reduce((s, t) => s + t.cantidad, 0);
    const meta = cantidadCortada(orden);
    if (suma !== meta) {
      throw new LotePlanificadoError(
        `Los talles del corte suman ${suma} y la OP dice ${meta} cortadas. Corregí la ficha de corte antes de separar: ` +
        'los minutos se reparten entre los lotes por unidades, y tienen que ser las que se cortaron.',
      );
    }
    const lote1 = await tx.lotePlanificado.create({
      data: {
        ordenId, numero: 1, despuesDe: DESPUES_DE_LOTE_1, separadoPor: session.nombre,
        talles: { create: cortado.map((t) => ({ talle: t.talle, cantidad: t.cantidad })) },
      },
    });
    // Lo que ya haya entrado antes de separar salió del corte entero, que ahora es el
    // Lote 1. Y se llevó minutos de una bolsa que hasta hoy no tenía lotes: todos comunes.
    await tx.$executeRaw`
      UPDATE "lotes_corte" SET "lotePlanificadoId" = ${lote1.id}, "minutosComunes" = "minutosImputados"
      WHERE "ordenId" = ${ordenId} AND "lotePlanificadoId" IS NULL`;
    lotes = await estadoDeLotes(tx, orden);
  }

  const lote1 = lotes.find((l) => l.numero === 1);
  if (!lote1) throw new LotePlanificadoError('La OP no tiene Lote 1: no hay de dónde separar');

  const disponible = new Map(lote1.sinIngresar.map((t) => [t.talle, t.cantidad]));
  for (const t of talles) {
    const hay = disponible.get(t.talle) ?? 0;
    if (t.cantidad > hay) {
      throw new LotePlanificadoError(
        `Al Lote 1 le quedan ${hay} de talle ${t.talle} sin ingresar y se quieren separar ${t.cantidad}.`,
      );
    }
  }
  const separadas = talles.reduce((s, t) => s + t.cantidad, 0);
  if (separadas >= lote1.unidades) {
    throw new LotePlanificadoError('El Lote 1 no puede quedar vacío: eso no es separar, es el mismo lote con otro número.');
  }

  for (const t of talles) {
    const actual = lote1.talles.find((x) => x.talle === t.talle)!.cantidad;
    if (actual === t.cantidad) {
      await tx.lotePlanificadoTalle.delete({ where: { loteId_talle: { loteId: lote1.id, talle: t.talle } } });
    } else {
      await tx.lotePlanificadoTalle.update({
        where: { loteId_talle: { loteId: lote1.id, talle: t.talle } },
        data: { cantidad: actual - t.cantidad },
      });
    }
  }

  const numero = Math.max(...lotes.map((l) => l.numero)) + 1;
  await tx.lotePlanificado.create({
    data: {
      ordenId, numero, despuesDe, separadoPor: session.nombre,
      talles: { create: talles.map((t) => ({ talle: t.talle, cantidad: t.cantidad })) },
    },
  });

  await tx.estadoTransicion.create({
    data: {
      ordenId, estadoAnterior: 'COSTURA', estadoNuevo: 'COSTURA', usuarioId: session.id,
      notas: `Separado Lote ${numero} (${textoTalles(talles)} = ${separadas} u) después de ${despuesDe}. ` +
             `El Lote 1 queda con ${lote1.unidades - separadas} u.`,
    },
  });

  return estadoDeLotes(tx, orden);
}

/**
 * Deshace el ÚLTIMO lote separado, para corregir un error de carga: sus talles vuelven al
 * Lote 1. Sólo mientras nada lo use — ni un ingreso ni un minuto de la tablet marcado con
 * su número: borrarlo dejaría esos minutos apuntando a un lote que no existe.
 */
export async function deshacerLote(
  tx: Prisma.TransactionClient,
  ordenId: string,
  numero: number,
  session: SessionPayload,
): Promise<EstadoLote[]> {
  const orden = await tx.ordenProduccion.findUnique({ where: { id: ordenId } });
  if (!orden) throw new LotePlanificadoError('OP no encontrada');
  const lotes = await estadoDeLotes(tx, orden);
  const lote = lotes.find((l) => l.numero === numero);
  const lote1 = lotes.find((l) => l.numero === 1);
  if (!lote || !lote1) throw new LotePlanificadoError(`La OP no tiene Lote ${numero}`);
  if (numero === 1) throw new LotePlanificadoError('El Lote 1 es el corte: no se deshace');
  if (numero !== Math.max(...lotes.map((l) => l.numero))) {
    throw new LotePlanificadoError('Sólo se puede deshacer el último lote separado');
  }
  if ([...lote.ingresadoPorParte.values()].some((m) => m.size > 0)) {
    throw new LotePlanificadoError(`El Lote ${numero} ya tiene ingresos: no se puede deshacer`);
  }
  const minutos = orden.sku?.trim()
    ? await tx.tiemposProduccion.count({ where: { sku: orden.sku.trim(), lote: numero } })
    : 0;
  if (minutos > 0) {
    throw new LotePlanificadoError(
      `La tablet ya tiene ${minutos} registro${minutos > 1 ? 's' : ''} marcado${minutos > 1 ? 's' : ''} con el Lote ${numero}: ` +
      'corregilos en Reportes antes de deshacerlo.',
    );
  }

  for (const t of lote.talles) {
    await tx.lotePlanificadoTalle.upsert({
      where: { loteId_talle: { loteId: lote1.id, talle: t.talle } },
      create: { loteId: lote1.id, talle: t.talle, cantidad: t.cantidad },
      update: { cantidad: { increment: t.cantidad } },
    });
  }
  await tx.lotePlanificado.delete({ where: { id: lote.id } });

  await tx.estadoTransicion.create({
    data: {
      ordenId, estadoAnterior: orden.estado, estadoNuevo: orden.estado, usuarioId: session.id,
      notas: `Deshecho el Lote ${numero} (${textoTalles(lote.talles)}): vuelve al Lote 1.`,
    },
  });

  return estadoDeLotes(tx, orden);
}

/** Un lote planificado listo para mandar a una pantalla: sin Maps, sólo datos planos. */
export interface LotePlanificadoDTO {
  id: string;
  numero: number;
  despuesDe: string;
  separadoAt: string;
  separadoPor: string;
  talles: TalleConteo[];
  unidades: number;
  ingresado: number;
  abierto: boolean;
  /** Lo que le falta ingresar por pieza (`''` si la prenda no se parte) y talle. */
  pendientePorParte: Record<string, TalleConteo[]>;
}

export function lotesParaPantalla(lotes: EstadoLote[]): LotePlanificadoDTO[] {
  return lotes.map((l) => ({
    id: l.id, numero: l.numero, despuesDe: l.despuesDe, separadoAt: l.separadoAt.toISOString(),
    separadoPor: l.separadoPor, talles: l.talles, unidades: l.unidades, ingresado: l.ingresado, abierto: l.abierto,
    pendientePorParte: Object.fromEntries([...l.ingresadoPorParte.entries()].map(([parte, ya]) => [
      parte,
      l.talles.map((t) => ({ talle: t.talle, cantidad: Math.max(0, t.cantidad - (ya.get(t.talle) ?? 0)) })),
    ])),
  }));
}

/**
 * Los lotes que todavía tienen algo por coser, de varias órdenes: `ordenId → [1, 2]`. Las
 * órdenes sin separar no aparecen. Es lo que la tablet ofrece como botones.
 */
export async function lotesAbiertosPorOrden(db: Db, ordenes: { id: string; sku: string | null }[]): Promise<Map<string, number[]>> {
  const salida = new Map<string, number[]>();
  if (ordenes.length === 0) return salida;
  const separadas = await db.lotePlanificado.findMany({
    where: { ordenId: { in: ordenes.map((o) => o.id) } },
    select: { ordenId: true },
    distinct: ['ordenId'],
  });
  for (const { ordenId } of separadas) {
    const orden = ordenes.find((o) => o.id === ordenId)!;
    salida.set(ordenId, (await estadoDeLotes(db, orden)).filter((l) => l.abierto).map((l) => l.numero));
  }
  return salida;
}
