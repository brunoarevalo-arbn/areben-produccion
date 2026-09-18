import type { Prisma, PrismaClient } from '@prisma/client';
import { calcularCostoMinuto } from '@/lib/costoMinuto';
import { baseDeRepartoConOrigen, type OrigenBase } from './cantidades';
import { marcaDeMuestra } from '@/lib/tiempos/registrar';

type Db = PrismaClient | Prisma.TransactionClient;

export class LoteCorteError extends Error {}

export interface TalleConteo { talle: string; cantidad: number }

/** La orden, con lo mínimo que hace falta para costear un lote suyo. */
export interface OrdenParaCostear {
  id: string;
  sku: string | null;
  cantidad: number;
  cantidadCortada: number | null;
  costoTotal: Prisma.Decimal;
}

export interface CostoCongelado {
  costoMaterialUnit: number;
  costoMoUnit: number;
  costoUnitario: number;
  minutosImputados: number;
  costoMinuto: number;
  sinCostoMaterial: boolean;
  /** Entre cuántas unidades se repartió el material, y si ésas son las cortadas o las planificadas. */
  unidadesBase: number;
  baseMaterial: OrigenBase;
}

const dosDecimales = (n: number) => Math.round(n * 100) / 100;

/**
 * Los minutos de COSTURA de la orden que todavía no se llevó ningún lote.
 *
 * 🔴 Los minutos de MUESTRA quedan afuera y no por prolijidad: una muestra ya se cobró
 * como `Gasto` de categoría 'desarrollo' cuando se registró el tiempo
 * (`crearTiempoConGasto`). Sumarlos acá cobraría los mismos minutos DOS veces — una al
 * desarrollo de la marca y otra al costo de la prenda. Quién es muestra lo decide
 * `marcaDeMuestra`, que es el mismo juez que los cobra; duplicar acá la lista de
 * actividades sería media regla en dos lados.
 *
 * ⚠️ Sólo cuentan los registros en estado 'guardado'. Un 'pendiente' es un cronómetro
 * que la costurera todavía no confirmó: imputarlo congelaría un costo sobre un número
 * que puede cambiar.
 */
export async function minutosSinImputar(
  tx: Db,
  orden: Pick<OrdenParaCostear, 'id' | 'sku'>,
): Promise<number> {
  if (!orden.sku?.trim()) return 0;

  const registros = await tx.tiemposProduccion.findMany({
    where: { sku: orden.sku.trim(), estado: 'guardado' },
    select: { actividad: true, marca: true, minutosNetos: true },
  });
  const minutosCostura = registros
    .filter((r) => marcaDeMuestra(r.actividad, r.marca) === null)
    .reduce((s, r) => s + r.minutosNetos, 0);

  const yaImputados = await tx.loteCorte.aggregate({
    where: { ordenId: orden.id },
    _sum: { minutosImputados: true },
  });

  const restante = minutosCostura - Number(yaImputados._sum.minutosImputados ?? 0);
  return restante > 0 ? restante : 0;
}

/**
 * El costo por unidad que se le congela a un lote en el momento de ingresarlo.
 *
 * **Material**: sale de la orden (tela + corte + sublimación, que es lo que hoy suma
 * `costoTotal`) repartido por lo CORTADO — nunca por lo ingresado ni por lo planificado:
 * la tela se consumió entera el día del corte, entre las unidades que salgan de él.
 *
 * **Mano de obra**: los minutos de costura del SKU que ningún lote anterior se llevó,
 * al `costoMinuto` absorbente del día, divididos por las unidades de ESTE lote. Es
 * deliberadamente desparejo entre lotes —el primero se lleva el arranque, el último lo
 * que quedó— porque es lo que realmente costó hasta ese día (decisión de Bruno,
 * 18-sep-2026). Lo que lo hace auditable es que el lote guarda los minutos y el $/min
 * con los que se calculó.
 *
 * 🔴 `permitirSinCosto` es OBLIGATORIO a propósito. Una orden sin ficha de corte tiene
 * `costoTotal` en 0, y congelar ese 0 callado dejaría mercadería valuada en cero para
 * siempre. El default es plantarse; entrar igual tiene que ser algo que alguien AFIRME,
 * y queda marcado en el lote (`sinCostoMaterial`).
 */
export async function calcularCostoCongelado(
  tx: Prisma.TransactionClient,
  orden: OrdenParaCostear,
  unidades: number,
  permitirSinCosto: boolean,
): Promise<CostoCongelado> {
  if (unidades <= 0) throw new LoteCorteError('Un lote no puede entrar con 0 unidades');

  const costoMaterialTotal = Number(orden.costoTotal);
  const base = baseDeRepartoConOrigen(orden);

  if (costoMaterialTotal <= 0 || base === null) {
    if (!permitirSinCosto) {
      const queFalta = base === null
        ? 'no tiene cargado cuánto se cortó'
        : 'no tiene ficha de corte cargada (material $0)';
      throw new LoteCorteError(
        `No se puede congelar el costo de ${orden.sku ?? orden.id}: ${queFalta}. ` +
        'Cargá la ficha de corte, o ingresá el lote marcándolo explícitamente como sin costo de material.',
      );
    }
  }

  const costoMaterialUnit = (costoMaterialTotal > 0 && base !== null)
    ? dosDecimales(costoMaterialTotal / base.unidades)
    : 0;

  const minutos = await minutosSinImputar(tx, orden);
  const costoMinuto = await calcularCostoMinuto(tx);
  const costoMoUnit = dosDecimales((minutos * costoMinuto) / unidades);

  return {
    costoMaterialUnit,
    costoMoUnit,
    costoUnitario: dosDecimales(costoMaterialUnit + costoMoUnit),
    minutosImputados: dosDecimales(minutos),
    costoMinuto: dosDecimales(costoMinuto),
    sinCostoMaterial: costoMaterialUnit === 0,
    unidadesBase: base?.unidades ?? 0,
    baseMaterial: base?.origen ?? 'planificado',
  };
}

/**
 * Crea el lote con su costo ya congelado. No toca stock ni avíos: de eso se ocupa
 * `terminarCosturaOrden`, que es quien lo llama dentro de su transacción.
 */
export async function crearLoteCongelado(
  tx: Prisma.TransactionClient,
  orden: OrdenParaCostear,
  talles: TalleConteo[],
  creadoPor: string,
  permitirSinCosto: boolean,
) {
  const positivos = talles.filter((t) => t.cantidad > 0);
  const unidades = positivos.reduce((s, t) => s + t.cantidad, 0);
  const costo = await calcularCostoCongelado(tx, orden, unidades, permitirSinCosto);

  const ultimo = await tx.loteCorte.aggregate({
    where: { ordenId: orden.id },
    _max: { numero: true },
  });

  return tx.loteCorte.create({
    data: {
      ordenId: orden.id,
      numero: (ultimo._max.numero ?? 0) + 1,
      unidades,
      ingresadoPor: creadoPor,
      costoMaterialUnit: costo.costoMaterialUnit,
      costoMoUnit: costo.costoMoUnit,
      costoUnitario: costo.costoUnitario,
      minutosImputados: costo.minutosImputados,
      costoMinuto: costo.costoMinuto,
      sinCostoMaterial: costo.sinCostoMaterial,
      unidadesBase: costo.unidadesBase,
      baseMaterial: costo.baseMaterial,
      talles: { create: positivos.map((t) => ({ talle: t.talle, cantidad: t.cantidad })) },
    },
    include: { talles: true },
  });
}
