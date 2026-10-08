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
// 🔑 La separación se puede PROGRAMAR al cargar el corte ("el Lote 2 son estas curvas,
// cuando termine el remallado"): queda con `activadoAt` en null y la orden sigue siendo un
// solo lote para la tablet, así que todo lo cosido hasta ahí va a la bolsa común. La
// costurera confirma en la tablet que terminó el proceso y recién ahí se activan.
// Después, cada lote VISIBLE (`enTaller`) aparece en la tablet como su propia fila y la
// costurera toca la bolsa que tiene en la mano. El taller decide qué ve con el ojo 👁/🙈.
//
// 🔑 Se separa siempre DEL LOTE 1: al separar por primera vez el Lote 1 nace con todo lo
// cortado por talle, y cada separación le saca lo suyo. La cantidad cortada de la orden
// (y con ella el pago al cortador) no se toca nunca.
//
// 🔑 FALLAS (8-oct-2026): una pieza que se pierde en un proceso (5 bombachas M de la RAYROS
// en el remallado) se registra EN SU LOTE, por pieza y talle. Desde ahí el lote espera
// 37 corpiños y 32 bombachas: el ingreso propone eso, el control de exceso lo respeta y el
// lote CIERRA cuando entra todo lo que quedó vivo — sin la falla, un lote con una pieza
// perdida quedaba abierto para siempre (lo ingresado es la pieza que MENOS entró).
// Los minutos ya trabajados en la pieza perdida ⛔ se descuentan: siguen en la bolsa y los
// pagan las que sí salen.
import type { Prisma, PrismaClient } from '@prisma/client';
import type { SessionPayload } from '@/lib/session';
import { DESPUES_DE_LOTE_1, MAQUINA_DEL_PROCESO, ordenarTalles, textoTalles } from '@/lib/constants/lotes';
import { cantidadCortada, tallesCortados } from './cantidades';
import { partesDeOrden } from './conjuntos';
import type { LotePlanParaCostear } from './loteCorte';

type Db = PrismaClient | Prisma.TransactionClient;

export class LotePlanificadoError extends Error {}

export interface TalleConteo { talle: string; cantidad: number }

export interface FallaDeLote {
  id: string;
  parte: string | null;
  talle: string;
  cantidad: number;
  proceso: string;
  motivo: string | null;
  registradoPor: string;
  createdAt: Date;
}

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
  /**
   * Por talle, las prendas ENTERAS que todavía no entraron ni fallaron en NINGUNA pieza: lo
   * único que se puede mover a otro lote (la que tiene una pieza fallada se queda con su lote).
   */
  sinIngresar: TalleConteo[];
  /** Fallas por pieza (`''` si la prenda no se parte) y talle. */
  fallasPorParte: Map<string, Map<string, number>>;
  fallas: FallaDeLote[];
  /** Lo que el lote espera de cada pieza: lo planificado menos sus fallas. */
  esperadoPorParte: Map<string, Map<string, number>>;
  /** Mientras a ALGUNA pieza le falte entrar algo de lo que espera. */
  abierto: boolean;
  /** null = programado: espera que la costurera confirme que terminó `despuesDe`. */
  activadoAt: Date | null;
  enTaller: boolean;
}

/**
 * Los lotes planificados de la orden con lo que ya entró de cada uno. `[]` = la orden no
 * está separada.
 */
export async function estadoDeLotes(db: Db, orden: { id: string; sku: string | null }): Promise<EstadoLote[]> {
  const lotes = await db.lotePlanificado.findMany({
    where: { ordenId: orden.id },
    orderBy: { numero: 'asc' },
    include: { talles: true, ingresos: { include: { talles: true } }, fallas: { orderBy: { createdAt: 'asc' } } },
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
    const fallasPorParte = new Map<string, Map<string, number>>(claves.map((k) => [k, new Map()]));
    for (const f of l.fallas) {
      const m = fallasPorParte.get(f.parte ?? '');
      if (!m) continue;
      m.set(f.talle, (m.get(f.talle) ?? 0) + f.cantidad);
    }
    const talles = ordenarTalles(l.talles.map((t) => ({ talle: t.talle, cantidad: t.cantidad })));
    const unidades = talles.reduce((s, t) => s + t.cantidad, 0);
    const de = (m: Map<string, Map<string, number>>, k: string, talle: string) => m.get(k)?.get(talle) ?? 0;
    const esperadoPorParte = new Map(claves.map((k) => [
      k, new Map(talles.map((t) => [t.talle, t.cantidad - de(fallasPorParte, k, t.talle)])),
    ]));
    const totalDe = (k: string) => [...(ingresadoPorParte.get(k)?.values() ?? [])].reduce((s, n) => s + n, 0);
    const ingresado = Math.min(...claves.map(totalDe));
    const sinIngresar = talles.map((t) => ({
      talle: t.talle,
      cantidad: Math.max(0, t.cantidad -
        Math.max(...claves.map((k) => de(ingresadoPorParte, k, t.talle) + de(fallasPorParte, k, t.talle)))),
    }));
    const abierto = claves.some((k) => talles.some((t) =>
      de(ingresadoPorParte, k, t.talle) < de(esperadoPorParte, k, t.talle)));
    return {
      id: l.id, numero: l.numero, despuesDe: l.despuesDe, separadoAt: l.separadoAt, separadoPor: l.separadoPor,
      talles, unidades, ingresadoPorParte, ingresado, sinIngresar, abierto,
      fallasPorParte, esperadoPorParte,
      fallas: l.fallas.map((f) => ({
        id: f.id, parte: f.parte, talle: f.talle, cantidad: f.cantidad, proceso: f.proceso, motivo: f.motivo,
        registradoPor: f.registradoPor, createdAt: f.createdAt,
      })),
      activadoAt: l.activadoAt, enTaller: l.enTaller,
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
  for (const c of conteos) {
    const k = c.parte ?? '';
    const ya = lote.ingresadoPorParte.get(k) ?? new Map<string, number>();
    const esperado = lote.esperadoPorParte.get(k) ?? new Map<string, number>();
    for (const t of c.talles) {
      if (t.cantidad <= 0) continue;
      const queda = (esperado.get(t.talle) ?? 0) - (ya.get(t.talle) ?? 0);
      if (t.cantidad > queda) {
        const fallas = lote.fallasPorParte.get(k)?.get(t.talle) ?? 0;
        return `El Lote ${lote.numero} ${c.parte ? `(${c.parte}) ` : ''}tiene ${Math.max(0, queda)} de talle ${t.talle} ` +
          `para ingresar${fallas > 0 ? ` (${fallas} fallada${fallas > 1 ? 's' : ''})` : ''} y el conteo dice ${t.cantidad}. ` +
          'Si salieron de otro lote, ingresalas en ese.';
      }
    }
  }
  return null;
}

/** La separación que espera confirmación, o `null`. Es UNA por orden: se activa entera. */
export function separacionProgramada(lotes: EstadoLote[]): string | null {
  const programado = lotes.find((l) => l.numero > 1 && !l.activadoAt);
  return programado ? programado.despuesDe : null;
}

/**
 * Separa un lote nuevo del Lote 1. La primera vez arma el Lote 1 con todo lo cortado.
 *
 * Con `programado` la separación queda esperando que la costurera confirme en la tablet
 * que terminó `despuesDe`; sin él, rige desde ya. El lote nuevo nace FUERA del taller: el
 * taller se lo da a la costurera cuando quiere (ver `ponerEnTaller`).
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
  programado = false,
): Promise<EstadoLote[]> {
  const orden = await tx.ordenProduccion.findUnique({ where: { id: ordenId }, include: { cortesPorTalle: true } });
  if (!orden) throw new LotePlanificadoError('OP no encontrada');
  // Programar se puede desde que hay corte cargado; separar YA, sólo mientras se cose.
  const estadosValidos = programado ? ['PENDIENTE', 'CORTE', 'COSTURA'] : ['COSTURA'];
  if (!estadosValidos.includes(orden.estado)) {
    throw new LotePlanificadoError(programado
      ? `La OP ${orden.sku ?? ordenId} ya salió de costura: no hay nada que programar`
      : `La OP ${orden.sku ?? ordenId} no está en costura: los lotes se separan mientras se cose (o se programan antes)`);
  }

  const talles = tallesInput.filter((t) => t.cantidad > 0);
  if (talles.length === 0) throw new LotePlanificadoError('Cargá cuántas van al lote nuevo en al menos un talle');
  if (new Set(talles.map((t) => t.talle)).size !== talles.length) throw new LotePlanificadoError('Hay talles repetidos');

  let lotes = await estadoDeLotes(tx, orden);
  // Una separación programada se activa ENTERA con la confirmación de la tablet: mezclar
  // lotes activos con programados dejaría la orden a medio separar.
  const pendiente = separacionProgramada(lotes);
  if (pendiente && !programado) {
    throw new LotePlanificadoError(`Hay una separación programada para después de ${pendiente}: activala o deshacela antes de separar otra.`);
  }
  if (programado && !MAQUINA_DEL_PROCESO[despuesDe]) {
    throw new LotePlanificadoError(`"${despuesDe}" no es un proceso de máquina: eso no se programa, se separa en el momento.`);
  }
  if (!pendiente && programado && lotes.some((l) => l.numero > 1)) {
    throw new LotePlanificadoError('La orden ya está separada: lo que se separe ahora rige desde ya, no se puede programar.');
  }
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
        activadoAt: programado ? null : new Date(), enTaller: true,
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
      activadoAt: programado ? null : new Date(), enTaller: false,
      talles: { create: talles.map((t) => ({ talle: t.talle, cantidad: t.cantidad })) },
    },
  });

  await tx.estadoTransicion.create({
    data: {
      ordenId, estadoAnterior: orden.estado, estadoNuevo: orden.estado, usuarioId: session.id,
      notas: `${programado ? 'Programado' : 'Separado'} Lote ${numero} (${textoTalles(talles)} = ${separadas} u) ` +
             `${programado ? 'para cuando termine' : 'después de'} ${despuesDe}. ` +
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
  // Las fallas viven en el lote: borrarlo se las llevaría sin que nadie lo vea.
  if (lote.fallas.length > 0) {
    throw new LotePlanificadoError(`El Lote ${numero} tiene fallas registradas: borralas antes de deshacerlo`);
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

/**
 * Activa la separación programada: la costurera confirmó en la tablet que terminó el
 * proceso (o alguien la activó a mano desde la OP). Desde acá la tablet asigna los lotes.
 */
export async function activarSeparacion(
  tx: Prisma.TransactionClient,
  ordenId: string,
  session: SessionPayload,
  desde: 'tablet' | 'op',
): Promise<EstadoLote[]> {
  const orden = await tx.ordenProduccion.findUnique({ where: { id: ordenId } });
  if (!orden) throw new LotePlanificadoError('OP no encontrada');
  const lotes = await estadoDeLotes(tx, orden);
  const pendiente = separacionProgramada(lotes);
  if (!pendiente) throw new LotePlanificadoError('Esta orden no tiene una separación esperando confirmación');

  await tx.lotePlanificado.updateMany({ where: { ordenId, activadoAt: null }, data: { activadoAt: new Date() } });
  await tx.estadoTransicion.create({
    data: {
      ordenId, estadoAnterior: orden.estado, estadoNuevo: orden.estado, usuarioId: session.id,
      notas: `${session.nombre} ${desde === 'tablet' ? 'confirmó desde la tablet' : 'confirmó desde la OP'} que terminó ` +
             `${pendiente}: se activan ${lotes.map((l) => `Lote ${l.numero}`).join(' y ')}. ` +
             `En el taller: ${lotes.filter((l) => l.enTaller).map((l) => `Lote ${l.numero}`).join(', ') || 'ninguno'}.`,
    },
  });
  return estadoDeLotes(tx, orden);
}

/** El taller muestra (u oculta) un lote en la tablet: el ojo 👁/🙈 del lote. */
export async function ponerEnTaller(
  tx: Prisma.TransactionClient,
  ordenId: string,
  numero: number,
  enTaller: boolean,
  session: SessionPayload,
): Promise<EstadoLote[]> {
  const orden = await tx.ordenProduccion.findUnique({ where: { id: ordenId } });
  if (!orden) throw new LotePlanificadoError('OP no encontrada');
  const lotes = await estadoDeLotes(tx, orden);
  const lote = lotes.find((l) => l.numero === numero);
  if (!lote) throw new LotePlanificadoError(`La OP no tiene Lote ${numero}`);
  if (lote.enTaller === enTaller) return lotes;

  await tx.lotePlanificado.update({ where: { id: lote.id }, data: { enTaller } });
  await tx.estadoTransicion.create({
    data: {
      ordenId, estadoAnterior: orden.estado, estadoNuevo: orden.estado, usuarioId: session.id,
      notas: `Lote ${numero} ${enTaller ? 'visible en la tablet' : 'oculto de la tablet'}.`,
    },
  });
  return estadoDeLotes(tx, orden);
}

/**
 * Los lotes que la tablet muestra, cada uno como su propia fila: activos, VISIBLES (el
 * taller no los ocultó) y con algo por ingresar. `[]` con la separación todavía
 * programada (la orden es un solo lote) o con todos ocultos.
 *
 * 🗣️ Bruno (6-oct): antes la tablet tomaba sola "el más chico de los que están en el
 * taller", y con los dos adentro el Lote 2 no aparecía. Se sacó: el taller oculta y
 * desoculta, y la costurera elige la bolsa.
 */
export interface FallaInput {
  numero: number;
  parte: string | null;
  talle: string;
  cantidad: number;
  proceso: string;
  motivo?: string | null;
}

/**
 * Registra piezas perdidas en un lote. Sólo lo que todavía ⛔ entró: lo ingresado ya es
 * stock y una falla de ahí es otra cosa (un ajuste de stock).
 */
export async function registrarFalla(
  tx: Prisma.TransactionClient,
  ordenId: string,
  f: FallaInput,
  session: SessionPayload,
): Promise<EstadoLote[]> {
  const orden = await tx.ordenProduccion.findUnique({ where: { id: ordenId } });
  if (!orden) throw new LotePlanificadoError('OP no encontrada');
  const lotes = await estadoDeLotes(tx, orden);
  if (lotes.length === 0) {
    throw new LotePlanificadoError('La OP no está separada en lotes: las fallas se registran en un lote');
  }
  const lote = lotes.find((l) => l.numero === f.numero);
  if (!lote) throw new LotePlanificadoError(`La OP no tiene Lote ${f.numero}`);

  const partes = [...lote.esperadoPorParte.keys()].filter((k) => k !== '');
  const k = f.parte ?? '';
  if (partes.length > 0 && !partes.includes(k)) {
    throw new LotePlanificadoError(`Elegí la pieza que falló (${partes.join(' o ')})`);
  }
  if (partes.length === 0 && f.parte) throw new LotePlanificadoError('Esta prenda no se cose por piezas');
  if (!lote.talles.some((t) => t.talle === f.talle)) {
    throw new LotePlanificadoError(`El Lote ${f.numero} no tiene talle ${f.talle}`);
  }
  const queda = (lote.esperadoPorParte.get(k)?.get(f.talle) ?? 0) - (lote.ingresadoPorParte.get(k)?.get(f.talle) ?? 0);
  if (f.cantidad > queda) {
    throw new LotePlanificadoError(
      `Al Lote ${f.numero} le quedan ${Math.max(0, queda)} ${f.parte ? `${f.parte.toLowerCase()}s ` : ''}talle ${f.talle} sin ingresar ` +
      `y se quieren dar por falladas ${f.cantidad}.`,
    );
  }

  await tx.fallaLote.create({
    data: {
      loteId: lote.id, parte: f.parte, talle: f.talle, cantidad: f.cantidad, proceso: f.proceso,
      motivo: f.motivo?.trim() || null, registradoPor: session.nombre,
    },
  });
  await tx.estadoTransicion.create({
    data: {
      ordenId, estadoAnterior: orden.estado, estadoNuevo: orden.estado, usuarioId: session.id,
      notas: `Falla en el Lote ${f.numero}: ${f.cantidad} ${f.parte ? `${f.parte.toLowerCase()}${f.cantidad > 1 ? 's' : ''} ` : ''}` +
             `talle ${f.talle}, en ${f.proceso}${f.motivo?.trim() ? ` (${f.motivo.trim()})` : ''}.`,
    },
  });
  return estadoDeLotes(tx, orden);
}

/** Borra una falla cargada por error: esas piezas vuelven a esperarse en su lote. */
export async function borrarFalla(
  tx: Prisma.TransactionClient,
  ordenId: string,
  fallaId: string,
  session: SessionPayload,
): Promise<EstadoLote[]> {
  const orden = await tx.ordenProduccion.findUnique({ where: { id: ordenId } });
  if (!orden) throw new LotePlanificadoError('OP no encontrada');
  const falla = await tx.fallaLote.findUnique({ where: { id: fallaId }, include: { lote: true } });
  if (!falla || falla.lote.ordenId !== ordenId) throw new LotePlanificadoError('Esa falla no es de esta OP');
  await tx.fallaLote.delete({ where: { id: fallaId } });
  await tx.estadoTransicion.create({
    data: {
      ordenId, estadoAnterior: orden.estado, estadoNuevo: orden.estado, usuarioId: session.id,
      notas: `Borrada la falla del Lote ${falla.lote.numero} (${falla.cantidad} ${falla.parte ?? ''} talle ${falla.talle}, ` +
             `${falla.proceso}): vuelven a esperarse.`,
    },
  });
  return estadoDeLotes(tx, orden);
}

export function lotesVisibles(lotes: EstadoLote[]): number[] {
  if (separacionProgramada(lotes)) return [];
  return lotes.filter((l) => l.activadoAt && l.enTaller && l.abierto).map((l) => l.numero);
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
  activadoAt: string | null;
  enTaller: boolean;
  /** Lo que le falta ingresar por pieza (`''` si la prenda no se parte) y talle: ya sin las fallas. */
  pendientePorParte: Record<string, TalleConteo[]>;
  /** Cuántas espera de cada pieza (lo planificado menos las fallas). */
  esperadoPorParte: Record<string, number>;
  fallas: { id: string; parte: string | null; talle: string; cantidad: number; proceso: string; motivo: string | null; registradoPor: string; createdAt: string }[];
}

export function lotesParaPantalla(lotes: EstadoLote[]): LotePlanificadoDTO[] {
  return lotes.map((l) => ({
    id: l.id, numero: l.numero, despuesDe: l.despuesDe, separadoAt: l.separadoAt.toISOString(),
    separadoPor: l.separadoPor, talles: l.talles, unidades: l.unidades, ingresado: l.ingresado, abierto: l.abierto,
    activadoAt: l.activadoAt?.toISOString() ?? null, enTaller: l.enTaller,
    pendientePorParte: Object.fromEntries([...l.ingresadoPorParte.entries()].map(([parte, ya]) => [
      parte,
      l.talles.map((t) => ({
        talle: t.talle,
        cantidad: Math.max(0, (l.esperadoPorParte.get(parte)?.get(t.talle) ?? 0) - (ya.get(t.talle) ?? 0)),
      })),
    ])),
    esperadoPorParte: Object.fromEntries([...l.esperadoPorParte.entries()].map(([parte, m]) => [
      parte, [...m.values()].reduce((s, n) => s + n, 0),
    ])),
    fallas: l.fallas.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })),
  }));
}

/** Lo que la tablet necesita saber de los lotes de una orden. */
export interface LotesParaTablet {
  /** Los lotes visibles: una fila de la tablet por cada uno. */
  lotes: number[];
  /** Si hay una separación esperando confirmación: el proceso que tiene que terminar. */
  confirmarDespuesDe: string | null;
}

/**
 * Los lotes de varias órdenes, como los usa la tablet. Las órdenes sin separar no aparecen.
 */
export async function lotesParaTablet(db: Db, ordenes: { id: string; sku: string | null }[]): Promise<Map<string, LotesParaTablet>> {
  const salida = new Map<string, LotesParaTablet>();
  if (ordenes.length === 0) return salida;
  const separadas = await db.lotePlanificado.findMany({
    where: { ordenId: { in: ordenes.map((o) => o.id) } },
    select: { ordenId: true },
    distinct: ['ordenId'],
  });
  for (const { ordenId } of separadas) {
    const lotes = await estadoDeLotes(db, ordenes.find((o) => o.id === ordenId)!);
    salida.set(ordenId, { lotes: lotesVisibles(lotes), confirmarDespuesDe: separacionProgramada(lotes) });
  }
  return salida;
}
