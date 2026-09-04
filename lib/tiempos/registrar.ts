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

/**
 * Deja el gasto de muestra igual a lo que dice el registro. Se llama cuando se
 * EDITA un tiempo: sin esto el registro decía 0 minutos y el gasto seguía
 * cobrando los 20 originales —pasó el 4-sep con la corrida de Bombacha entera,
 * $2.694 que ya no correspondían—. Mismo criterio que el `movimientoId` de un
 * retiro de tela: el gasto automático sigue a su origen o se borra.
 */
export async function sincronizarGastoDeMuestra(tiempoId: string) {
  const t = await prisma.tiemposProduccion.findUnique({ where: { id: tiempoId } });
  if (!t) return;

  // Sólo los gastos AUTOMÁTICOS: uno cargado a mano como compra (con proveedor
  // o con seguimiento de pago) no lo pisa un cambio de horario.
  const gasto = await prisma.gasto.findFirst({
    where: { tiempoId, proveedorId: null, estadoPago: null },
  });

  const marca = marcaDeMuestra(t.actividad, t.marca);
  const minutos = Math.round(t.minutosNetos);

  if (!marca || minutos <= 0) {
    if (gasto) await prisma.gasto.delete({ where: { id: gasto.id } });
    return;
  }

  const costoMinuto = await calcularCostoMinuto();
  const monto = Math.round(minutos * costoMinuto);
  const concepto = `Muestra ${marca}${t.sku ? ` — ${t.sku}` : ''}`;

  if (gasto) {
    await prisma.gasto.update({
      where: { id: gasto.id },
      data: { marca, sku: t.sku, minutos, monto, concepto, fecha: t.fecha },
    });
  } else {
    await prisma.gasto.create({
      data: {
        categoria: 'desarrollo', tipo: 'periodo', marca, sku: t.sku,
        minutos, monto, concepto, fecha: t.fecha, creadoPor: t.usuario, tiempoId: t.id,
      },
    });
  }
}
