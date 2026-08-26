// Acceso a una corrida de muestra y el partido del tiempo en tramos.
// Vive acá, y no en cada route handler, porque el tiempo se parte en UN solo
// lugar: si hay dos, hay dos formas de perder un minuto.

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { resumen, type MedicionLike, type PasoLike } from './corrida';

export const CORRIDA_INCLUDE = {
  pasos: { orderBy: { orden: 'asc' } },
  mediciones: { orderBy: { createdAt: 'asc' } },
  ribetes: { orderBy: { orden: 'asc' } },
} satisfies Prisma.CorridaMuestraInclude;

export type CorridaCompleta = Prisma.CorridaMuestraGetPayload<{ include: typeof CORRIDA_INCLUDE }>;

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
      id: r.id, orden: r.orden, nombre: r.nombre, anchoCm: r.anchoCm, largoCm: r.largoCm,
    })),
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
            horaFin: cmd.horaFin ?? new Date().toTimeString().slice(0, 8),
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
          horaInicio: cmd.horaFin ?? new Date().toTimeString().slice(0, 8),
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
