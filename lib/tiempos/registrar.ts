import { prisma } from '@/lib/prisma';
import { calcularCostoMinuto } from '@/lib/costoMinuto';
import type { TiempoInput } from '@/lib/validators/tiempos';
import { ACTIVIDAD_PROCESO } from '@/lib/constants/actividades';

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

// El trabajo LIBRE (sin orden) también es tiempo de costurera que se paga: no
// entra a ningún lote porque no tiene SKU, así que sin gasto se perdía —64
// registros y ~95 h desde mayo—. Va a una categoría propia, `taller`, sin marca,
// para no inflar desarrollo. Desde esta fecha la tablet obliga a elegir orden o
// "trabajo libre", así que un Proceso Completado sin SKU ES libre; antes podía
// ser un olvido, y por eso lo viejo ⛔ cobra gasto ni aunque se edite.
export const TALLER_DESDE = '2026-10-02';

type RegistroConGasto = {
  actividad: string;
  marca?: string | null;
  sku?: string | null;
  detalle?: string | null;
  fecha: string;
};

/**
 * Qué gasto le corresponde a un registro, o null si ninguno. La regla vive acá
 * y SÓLO acá: la usan el alta y la sincronización, así que corregir un libre a
 * una orden le borra el gasto de taller —si no, se cobraría dos veces: gasto y
 * minutos del lote—.
 */
export function gastoDelTiempo(t: RegistroConGasto): { categoria: string; marca: string | null; concepto: string } | null {
  const marca = marcaDeMuestra(t.actividad, t.marca);
  if (marca) {
    return { categoria: 'desarrollo', marca, concepto: `Muestra ${marca}${t.sku ? ` — ${t.sku}` : ''}` };
  }
  // `!marca`: una orden sin SKU trae la marca de la orden, y eso ⛔ es libre.
  if (t.actividad === ACTIVIDAD_PROCESO && !t.sku && !t.marca && t.fecha >= TALLER_DESDE) {
    return { categoria: 'taller', marca: null, concepto: `Taller — ${t.detalle?.trim() || 'trabajo libre'}` };
  }
  return null;
}

/**
 * El registro de tiempo y su gasto —de muestra o de taller—, en UN solo lugar:
 * lo llaman el alta manual de la tablet y el cierre de una corrida. Si la regla
 * viviera en el route handler, una muestra medida con el cronómetro costaría
 * plata y la misma muestra medida con la corrida saldría gratis.
 */
export async function crearTiempoConGasto(datos: TiempoInput) {
  const tiempo = await prisma.tiemposProduccion.create({ data: datos });
  await sincronizarGastoDelTiempo(tiempo.id);
  return tiempo;
}

/**
 * Deja el gasto automático igual a lo que dice el registro. Se llama al crear y
 * cuando se EDITA un tiempo: sin esto el registro decía 0 minutos y el gasto
 * seguía cobrando los 20 originales —pasó el 4-sep con la corrida de Bombacha
 * entera, $2.694 que ya no correspondían—. Mismo criterio que el `movimientoId`
 * de un retiro de tela: el gasto automático sigue a su origen o se borra.
 */
export async function sincronizarGastoDelTiempo(tiempoId: string) {
  const t = await prisma.tiemposProduccion.findUnique({ where: { id: tiempoId } });
  if (!t) return;

  // Sólo los gastos AUTOMÁTICOS: uno cargado a mano como compra (con proveedor
  // o con seguimiento de pago) no lo pisa un cambio de horario.
  const gasto = await prisma.gasto.findFirst({
    where: { tiempoId, proveedorId: null, estadoPago: null },
  });

  const corresponde = gastoDelTiempo(t);
  const minutos = Math.round(t.minutosNetos);

  if (!corresponde || minutos <= 0) {
    if (gasto) await prisma.gasto.delete({ where: { id: gasto.id } });
    return;
  }

  const costoMinuto = await calcularCostoMinuto();
  const monto = Math.round(minutos * costoMinuto);
  // `categoria` va en el update: un libre que pasa a muestra (o al revés) cambia
  // de categoría, no sólo de concepto.
  const { categoria, marca, concepto } = corresponde;

  if (gasto) {
    await prisma.gasto.update({
      where: { id: gasto.id },
      data: { categoria, marca, sku: t.sku, minutos, monto, concepto, fecha: t.fecha },
    });
  } else {
    await prisma.gasto.create({
      data: {
        categoria, tipo: 'periodo', marca, sku: t.sku,
        minutos, monto, concepto, fecha: t.fecha, creadoPor: t.usuario, tiempoId: t.id,
      },
    });
  }
}
