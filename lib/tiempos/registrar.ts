import { prisma } from '@/lib/prisma';
import { calcularCostoMinuto } from '@/lib/costoMinuto';
import type { TiempoInput } from '@/lib/validators/tiempos';

// Una corrida de muestra ES trabajo de costura: al terminarla, el tiempo medido
// entra al registro del día de la costurera igual que si lo hubiera cargado a
// mano. Por eso son actividades de MUESTRA y no una categoría nueva.
export const ACTIVIDAD_RELEVAMIENTO = 'Muestra - Relevamiento';
export const ACTIVIDAD_MEDICION = 'Muestra - Medición';

// Qué marca paga la muestra. Las dos primeras vienen del nombre de la
// actividad; en una corrida la marca la trae la corrida, así que se pasa.
const MARCAS_MUESTRA: Record<string, string> = {
  'Muestra Zattia': 'Zattia',
  'Muestra Stunned': 'Stunned',
};

export function marcaDeMuestra(actividad: string, marca?: string | null): string | null {
  if (actividad === ACTIVIDAD_RELEVAMIENTO || actividad === ACTIVIDAD_MEDICION) {
    return marca || null;
  }
  return MARCAS_MUESTRA[actividad] ?? null;
}

/**
 * El registro de tiempo y —si es muestra— su gasto de desarrollo, en UN solo
 * lugar: lo llaman el alta manual de la tablet y el cierre de una corrida. Si
 * la regla viviera en el route handler, una muestra medida con el cronómetro
 * costaría plata y la misma muestra medida con la corrida saldría gratis.
 */
export async function crearTiempoConGasto(datos: TiempoInput) {
  const tiempo = await prisma.tiemposProduccion.create({ data: datos });

  const marcaMuestra = marcaDeMuestra(datos.actividad, datos.marca);
  if (marcaMuestra && datos.minutosNetos > 0) {
    const costoMinuto = await calcularCostoMinuto();
    const monto = Math.round(datos.minutosNetos * costoMinuto);
    await prisma.gasto.create({
      data: {
        categoria: 'desarrollo',
        tipo: 'periodo',
        marca: marcaMuestra,
        sku: datos.sku || null,
        minutos: Math.round(datos.minutosNetos),
        monto,
        concepto: `Muestra ${marcaMuestra}${datos.sku ? ` — ${datos.sku}` : ''}`,
        fecha: datos.fecha,
        creadoPor: datos.usuario,
        tiempoId: tiempo.id,
      },
    });
  }

  return tiempo;
}
