// Acceso a una corrida de muestra y el partido del tiempo en tramos.
// Vive acá, y no en cada route handler, porque el tiempo se parte en UN solo
// lugar: si hay dos, hay dos formas de perder un minuto.

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { resumen, resumenTubo, type MedicionLike, type PasoLike, type CorteLike, type RibeteLike } from './corrida';

// La hora que se guarda es la del TALLER, no la del servidor. En Vercel el
// servidor corre en UTC: con new Date().toTimeString() el primer tramo de cada
// corrida —el unico que no trae hora del cronometro de la tablet— quedaba 3
// horas adelantado y arrancaba DESPUES de terminar (medido: 12:49:39 -> 09:49:49).
export function horaTaller(): string {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour12: false,
  });
}

export const CORRIDA_INCLUDE = {
  pasos: { orderBy: { orden: 'asc' } },
  mediciones: { orderBy: { createdAt: 'asc' } },
  ribetes: { orderBy: { orden: 'asc' } },
  cortes: { orderBy: [{ unidad: 'asc' }, { orden: 'asc' }] },
} satisfies Prisma.CorridaMuestraInclude;

export type CorridaCompleta = Prisma.CorridaMuestraGetPayload<{ include: typeof CORRIDA_INCLUDE }>;

/**
 * Las corridas abiertas que puede tomar quien pide: cada costurera ve las
 * suyas, el admin ve todas —así se prueba sin la tablet de la costurera—. La
 * consulta vive acá porque la usan la pantalla de relevamientos y la API.
 */
export async function corridasAbiertasDe(session: { nombre: string; rol: string }) {
  const corridas = await prisma.corridaMuestra.findMany({
    where: {
      ...(session.rol === 'admin' ? {} : { costurera: session.nombre }),
      estado: { in: ['pendiente', 'en_curso'] },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, nombre: true, tipoPrenda: true, talle: true, modo: true,
      estado: true, costurera: true, unidadActual: true, unidadesObjetivo: true,
      // Un tramo sin horaFin es el que está corriendo AHORA. Se muestra porque
      // sin reloj maestro, un cronómetro olvidado en otra corrida sigue sumando
      // y nada más lo delata.
      mediciones: { where: { horaFin: null }, select: { id: true }, take: 1 },
    },
  });

  const filas = corridas.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    tipoPrenda: c.tipoPrenda,
    talle: c.talle,
    modo: c.modo,
    estado: c.estado,
    costurera: c.costurera,
    unidadActual: c.unidadActual,
    unidadesObjetivo: c.unidadesObjetivo,
    corriendo: c.mediciones.length > 0,
  }));

  // La que tiene el reloj corriendo primero, después las empezadas, y al final
  // las que todavía no arrancaron, en el orden en que se cargaron.
  const peso = (f: (typeof filas)[number]) => (f.corriendo ? 0 : f.estado === 'en_curso' ? 1 : 2);
  return filas.sort((a, b) => peso(a) - peso(b));
}

export type CorridaAbierta = Awaited<ReturnType<typeof corridasAbiertasDe>>[number];

export function cargarCorrida(id: string) {
  return prisma.corridaMuestra.findUnique({ where: { id }, include: CORRIDA_INCLUDE });
}

/** El tramo que está corriendo ahora: el único sin `horaFin`. */
export function tramoAbierto(c: CorridaCompleta) {
  return c.mediciones.find((m) => m.horaFin == null) ?? null;
}

export function resumenDe(c: CorridaCompleta) {
  return resumen(c.pasos as PasoLike[], c.mediciones as MedicionLike[]);
}

export function tuboDe(c: CorridaCompleta) {
  return resumenTubo(c.ribetes as RibeteLike[], c.cortes as CorteLike[]);
}

/** Lo que ven tanto la tablet como la ficha. Un solo shape, una sola verdad. */
export function serializar(c: CorridaCompleta) {
  const abierto = tramoAbierto(c);
  return {
    id: c.id,
    nombre: c.nombre,
    tipoPrenda: c.tipoPrenda,
    marca: c.marca,
    modo: c.modo,
    talle: c.talle,
    costurera: c.costurera,
    escandalloId: c.escandalloId,
    sku: c.sku,
    estado: c.estado,
    unidadesObjetivo: c.unidadesObjetivo,
    unidadActual: c.unidadActual,
    notas: c.notas,
    aplicadaAt: c.aplicadaAt,
    pasos: c.pasos.map((p) => ({
      id: p.id, orden: p.orden, nombre: p.nombre, maquina: p.maquina,
      nacidoEnCorrida: p.nacidoEnCorrida,
    })),
    ribetes: c.ribetes.map((r) => ({
      id: r.id, orden: r.orden, nombre: r.nombre, anchoCm: r.anchoCm,
    })),
    cortes: c.cortes.map((t) => ({
      id: t.id, ribeteId: t.ribeteId, unidad: t.unidad, orden: t.orden, largoCm: t.largoCm,
    })),
    tubo: tuboDe(c),
    // A qué paso se vuelve cuando termina una pausa: el último de trabajo de
    // esta prenda. Una pausa NO es un paso nuevo, así que reanudar tiene que
    // devolver a lo que se estaba haciendo, sin declarar nada de nuevo.
    reanudar: (() => {
      const ultimo = [...c.mediciones].reverse().find(
        (m) => m.tipo === 'paso' && m.pasoId != null && m.unidad === c.unidadActual,
      );
      if (!ultimo?.pasoId) return null;
      const paso = c.pasos.find((p) => p.id === ultimo.pasoId);
      return { pasoId: ultimo.pasoId, nombre: paso?.nombre ?? 'lo anterior', maquina: ultimo.maquina ?? paso?.maquina ?? null };
    })(),
    // Los segundos que este paso YA lleva en esta prenda (tramos cerrados). El
    // reloj de la tablet arranca desde acá y no desde cero: al reanudar —o al
    // cambiar de máquina, que también corta el tramo— el proceso tiene que
    // seguir contando donde estaba, aunque por debajo sean tramos distintos.
    acumuladoSeg: (() => {
      const pasoId = abierto?.pasoId
        ?? [...c.mediciones].reverse().find((m) => m.tipo === 'paso' && m.pasoId != null && m.unidad === c.unidadActual)?.pasoId;
      if (!pasoId) return 0;
      const seg = c.mediciones
        .filter((m) => m.pasoId === pasoId && m.unidad === c.unidadActual && m.horaFin != null)
        .reduce((t, m) => t + m.minutosNetos * 60, 0);
      return Math.round(seg);
    })(),
    abierto: abierto
      ? { id: abierto.id, tipo: abierto.tipo, pasoId: abierto.pasoId, maquina: abierto.maquina, motivo: abierto.motivo }
      : null,
    resumen: resumenDe(c),
  };
}

export interface Siguiente {
  tipo: 'paso' | 'parada';
  pasoId?: string;
  nuevoPaso?: { nombre: string; maquina: string };
  maquina?: string;
  motivo?: string;
}

export interface CerrarYAbrir {
  minutos: number;
  horaInicio?: string;
  horaFin?: string;
  siguiente?: Siguiente | null;
  avanzarUnidad?: boolean;
}

/**
 * El único gesto del modelo: cerrar el tramo que corre y abrir el que sigue.
 * Los cinco botones de la tablet —cambiar de máquina, siguiente paso, agregar un
 * paso, parar, terminar la prenda— son este mismo movimiento con distinto
 * `siguiente`. El cronómetro de la costurera nunca se detiene.
 */
export async function cerrarYAbrir(corridaId: string, cmd: CerrarYAbrir) {
  return prisma.$transaction(async (tx) => {
    const c = await tx.corridaMuestra.findUnique({ where: { id: corridaId }, include: CORRIDA_INCLUDE });
    if (!c) throw new Error('La corrida no existe');
    if (c.estado === 'terminada' || c.estado === 'anulada') throw new Error('La corrida ya está cerrada');

    const abierto = c.mediciones.find((m) => m.horaFin == null) ?? null;
    if (abierto) {
      // Un tramo de menos de 3 segundos es un toque de más, no una medición:
      // se borra en vez de ensuciar el promedio con un cero.
      if (cmd.minutos < 0.05) {
        await tx.corridaMedicion.delete({ where: { id: abierto.id } });
      } else {
        await tx.corridaMedicion.update({
          where: { id: abierto.id },
          data: {
            minutosNetos: cmd.minutos,
            horaInicio: cmd.horaInicio ?? abierto.horaInicio,
            horaFin: cmd.horaFin ?? horaTaller(),
          },
        });
      }
    }

    let unidad = c.unidadActual;
    if (cmd.avanzarUnidad) {
      unidad = c.unidadActual + 1;
      await tx.corridaMuestra.update({ where: { id: c.id }, data: { unidadActual: unidad } });
    }

    if (cmd.siguiente) {
      const s = cmd.siguiente;
      let pasoId = s.pasoId ?? null;

      if (s.tipo === 'paso' && s.nuevoPaso) {
        // Relevamiento: el paso nace acá, declarado por la costurera.
        const orden = c.pasos.reduce((max, p) => Math.max(max, p.orden), 0) + 1;
        const creado = await tx.corridaPaso.create({
          data: {
            corridaId: c.id, orden,
            nombre: s.nuevoPaso.nombre, maquina: s.nuevoPaso.maquina,
            nacidoEnCorrida: true,
          },
        });
        pasoId = creado.id;
      }

      if (s.tipo === 'paso' && !pasoId) throw new Error('Falta el paso a arrancar');

      await tx.corridaMedicion.create({
        data: {
          corridaId: c.id,
          pasoId: s.tipo === 'paso' ? pasoId : null,
          unidad,
          tipo: s.tipo,
          motivo: s.tipo === 'parada' ? (s.motivo ?? null) : null,
          maquina: s.tipo === 'paso' ? (s.maquina ?? null) : null,
          minutosNetos: 0,
          horaInicio: cmd.horaFin ?? horaTaller(),
          horaFin: null,
        },
      });
    }

    if (c.estado === 'pendiente') {
      await tx.corridaMuestra.update({
        where: { id: c.id },
        data: { estado: 'en_curso', iniciadaAt: new Date() },
      });
    }

    const fresca = await tx.corridaMuestra.findUnique({ where: { id: c.id }, include: CORRIDA_INCLUDE });
    return fresca!;
  });
}
