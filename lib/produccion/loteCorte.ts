import type { Prisma, PrismaClient } from '@prisma/client';
import { calcularCostoMinuto } from '@/lib/costoMinuto';
import { baseDeRepartoConOrigen, type OrigenBase } from './cantidades';
import { skuDeParte } from './conjuntos';
import { marcaDeMuestra } from '@/lib/tiempos/registrar';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * `afirmable` distingue los dos frenos, que se parecen y no son lo mismo:
 *  - **afirmable** (una ORDEN sin ficha de corte): la persona puede entrar igual
 *    afirmándolo, y el lote queda marcado `sinCostoMaterial`.
 *  - **NO afirmable** (falta el % de material de la parte, o la parte no tiene SKU):
 *    es un dato que nadie cargó todavía. Tildar una casilla no lo conseguiría — lo único
 *    que haría es congelar un reparto inventado. Se planta y no ofrece salida.
 */
export class LoteCorteError extends Error {
  readonly afirmable: boolean;
  constructor(message: string, afirmable = true) {
    super(message);
    this.afirmable = afirmable;
  }
}

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
  minutosCompartidos: number;
  minutosComunes: number;
  costoMinuto: number;
  sinCostoMaterial: boolean;
  /** Entre cuántas unidades se repartió el material, y si ésas son las cortadas o las planificadas. */
  unidadesBase: number;
  baseMaterial: OrigenBase;
}

/**
 * La parte que entra en un lote, ya resuelta: cómo se llama, a qué SKU va y qué % del
 * material del corte se lleva. `null` = la prenda no se parte y el lote entra entero al
 * SKU de la orden, que es como funcionó todo hasta la temporada de bikinis.
 */
export interface ParteDelLote {
  nombre: string;
  sku: string;
  porcentajeMaterial: number;
  /** Los minutos que le tocan a esta pieza, ya resueltos por `minutosSinImputarPorParte`. */
  minutos: MinutosDeParte;
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

  const minutosCostura = (await minutosDeCostura(tx, orden.sku)).reduce((s, r) => s + r.minutosNetos, 0);

  const yaImputados = await tx.loteCorte.aggregate({
    where: { ordenId: orden.id },
    _sum: { minutosImputados: true },
  });

  const restante = minutosCostura - Number(yaImputados._sum.minutosImputados ?? 0);
  return restante > 0 ? restante : 0;
}

/** Los registros de costura del SKU que entran al costo: guardados y que no son muestra. */
async function minutosDeCostura(tx: Db, sku: string) {
  const registros = await tx.tiemposProduccion.findMany({
    where: { sku: sku.trim(), estado: 'guardado' },
    select: { actividad: true, marca: true, minutosNetos: true, parte: true, lote: true },
  });
  return registros.filter((r) => marcaDeMuestra(r.actividad, r.marca) === null);
}

/** Lo que le toca a una parte de los minutos que ningún lote se llevó. */
export interface MinutosDeParte {
  minutos: number;
  /** De esos minutos, cuántos vinieron del reparto mitad y mitad (no están medidos). */
  compartidos: number;
  /**
   * De esos minutos, cuántos vinieron de la bolsa COMÚN de una orden separada en lotes
   * planificados: los registros sin lote, repartidos por unidades. 0 si la orden no está
   * separada.
   */
  comunes?: number;
}

/** El lote planificado en el que entra un ingreso, con lo que hace falta para costearlo. */
export interface LotePlanParaCostear {
  id: string;
  numero: number;
  /** Las unidades planificadas de ESTE lote. */
  unidades: number;
  /** Las unidades planificadas de TODOS los lotes de la orden: el denominador de la bolsa común. */
  unidadesTotales: number;
  /** Los números de lote que existen: un registro con otro número cae a la bolsa común. */
  numeros: number[];
}

/**
 * Los minutos pendientes de UN LOTE PLANIFICADO, por pieza (o en `''` si la prenda no se
 * parte).
 *
 * 🔑 Los minutos se parten por MARCA, no por fecha: la tablet no tiene lista de procesos
 * ("remallado" es una máquina) y el costo nunca filtró por fecha.
 *  - los registros con `lote = N` son del lote N, y de nadie más;
 *  - los registros SIN lote (todo lo anterior a separar el corte, y lo que alguien cargó
 *    sin decir el lote) son de todos: se reparten **por unidades planificadas** —un lote
 *    de 20 sobre 62 se lleva 20/62 de la bolsa común—.
 * Dentro del lote, el reparto por pieza es el mismo de `minutosSinImputarPorParte`.
 *
 * 🔴 La cuota de la bolsa común tiene DOS topes, y hacen falta los dos: lo que a este lote
 * le toca por unidades, menos lo que ya se llevó; y lo que queda en la bolsa, menos lo
 * que se llevaron TODOS. Sin el segundo, un ingreso hecho antes de separar (que se llevó
 * la bolsa entera) más la cuota del lote nuevo contarían los mismos minutos dos veces.
 */
export async function minutosSinImputarDelLote(
  tx: Db,
  orden: Pick<OrdenParaCostear, 'id' | 'sku'>,
  partes: string[],
  lote: LotePlanParaCostear,
): Promise<Map<string, MinutosDeParte>> {
  const claves = partes.length > 0 ? partes : [''];
  const salida = new Map<string, MinutosDeParte>();
  if (!orden.sku?.trim() || lote.unidadesTotales <= 0) {
    for (const k of claves) salida.set(k, { minutos: 0, compartidos: 0, comunes: 0 });
    return salida;
  }

  const registros = await minutosDeCostura(tx, orden.sku);
  const conocidas = new Set(partes);
  const existentes = new Set(lote.numeros);

  const loteIdent = new Map<string, number>(claves.map((k) => [k, 0]));
  const comunIdent = new Map<string, number>(claves.map((k) => [k, 0]));
  let lotePool = 0;
  let comunPool = 0;
  for (const r of registros) {
    const esDelLote = r.lote === lote.numero;
    const esComun = r.lote == null || !existentes.has(r.lote);
    if (!esDelLote && !esComun) continue; // es de otro lote
    const clave = partes.length === 0 ? '' : (r.parte && conocidas.has(r.parte) ? r.parte : null);
    if (clave === null) {
      if (esDelLote) lotePool += r.minutosNetos; else comunPool += r.minutosNetos;
    } else {
      const m = esDelLote ? loteIdent : comunIdent;
      m.set(clave, (m.get(clave) ?? 0) + r.minutosNetos);
    }
  }

  const sumas = { _sum: { minutosImputados: true, minutosCompartidos: true, minutosComunes: true } } as const;
  const [delLote, deTodos] = await Promise.all([
    tx.loteCorte.groupBy({ by: ['parte'], where: { ordenId: orden.id, lotePlanificadoId: lote.id }, ...sumas }),
    tx.loteCorte.groupBy({ by: ['parte'], where: { ordenId: orden.id }, ...sumas }),
  ]);
  const leer = (filas: typeof delLote, k: string, campo: 'minutosImputados' | 'minutosCompartidos' | 'minutosComunes') =>
    Number(filas.find((f) => (f.parte ?? '') === k)?._sum[campo] ?? 0);

  const fraccion = lote.unidades / lote.unidadesTotales;
  const n = claves.length;
  for (const k of claves) {
    const propiosBrutos = (loteIdent.get(k) ?? 0) + lotePool / n;
    const comunBruto = (comunIdent.get(k) ?? 0) + comunPool / n;

    const comunesYaDelLote = leer(delLote, k, 'minutosComunes');
    const comunesYaDeTodos = leer(deTodos, k, 'minutosComunes');
    const comunes = Math.max(0, Math.min(
      comunBruto * fraccion - comunesYaDelLote,
      comunBruto - comunesYaDeTodos,
    ));
    const propiosYa = leer(delLote, k, 'minutosImputados') - comunesYaDelLote;
    const propios = Math.max(0, propiosBrutos - propiosYa);
    const minutos = propios + comunes;

    // Lo no medido por pieza (el mitad y mitad), tanto de los propios como de la cuota común.
    const compartidosBrutos = partes.length === 0 ? 0
      : lotePool / n + (comunBruto > 0 ? (comunPool / n) * (comunes / comunBruto) : 0);
    const compartidos = Math.min(minutos, Math.max(0, compartidosBrutos - leer(delLote, k, 'minutosCompartidos')));

    salida.set(k, { minutos, compartidos, comunes });
  }
  return salida;
}

/**
 * Los minutos pendientes **de cada parte**.
 *
 * Los que la tablet etiquetó van derecho a su pieza. Los que no —los `Compartido`, que
 * son una afirmación ("la cortacollareta arma el tubo para las dos"), y los que quedaron
 * sin etiquetar, que son un agujero— se reparten **mitad y mitad** entre las partes
 * (decisión de Bruno, 18-sep-2026).
 *
 * 🔴 Los minutos sin etiquetar NO se dejan afuera, aunque sean el agujero conocido de la
 * tablet (el 82% de una semana de setiembre no dice ni qué prenda se hizo). Dejarlos
 * afuera no los haría más honestos: haría que el costo de MO de la orden sea MENOR que
 * los minutos que realmente se trabajaron, callado. Se reparten y el lote **guarda
 * cuántos** fueron (`minutosCompartidos`), que es lo que después deja decir "de estos
 * $X, sólo $Y están medidos".
 *
 * ⚠️ Una parte que la tablet guardó con un nombre que hoy no está en el catálogo (alguien
 * la renombró) cae al pool compartido: no se puede afirmar de qué pieza es.
 */
export async function minutosSinImputarPorParte(
  tx: Db,
  orden: Pick<OrdenParaCostear, 'id' | 'sku'>,
  partes: string[],
): Promise<Map<string, MinutosDeParte>> {
  const salida = new Map<string, MinutosDeParte>();
  if (partes.length === 0) return salida;
  if (!orden.sku?.trim()) {
    for (const p of partes) salida.set(p, { minutos: 0, compartidos: 0 });
    return salida;
  }

  const registros = await minutosDeCostura(tx, orden.sku);
  const conocidas = new Set(partes);

  const identificados = new Map<string, number>(partes.map((p) => [p, 0]));
  let pool = 0;
  for (const r of registros) {
    if (r.parte && conocidas.has(r.parte)) {
      identificados.set(r.parte, (identificados.get(r.parte) ?? 0) + r.minutosNetos);
    } else {
      pool += r.minutosNetos;
    }
  }
  const poolPorParte = pool / partes.length;

  // Lo que los lotes anteriores YA se llevaron, por parte. Se resta por parte y no en
  // total: si no, el primer lote de una pieza podría llevarse los minutos de la otra.
  const previos = await tx.loteCorte.groupBy({
    by: ['parte'],
    where: { ordenId: orden.id, parte: { in: partes } },
    _sum: { minutosImputados: true, minutosCompartidos: true },
  });
  const imputado = new Map(previos.map((p) => [p.parte ?? '', Number(p._sum.minutosImputados ?? 0)]));
  const imputadoCompartido = new Map(previos.map((p) => [p.parte ?? '', Number(p._sum.minutosCompartidos ?? 0)]));

  for (const p of partes) {
    const bruto = (identificados.get(p) ?? 0) + poolPorParte;
    const minutos = Math.max(0, bruto - (imputado.get(p) ?? 0));
    const compartidos = Math.min(minutos, Math.max(0, poolPorParte - (imputadoCompartido.get(p) ?? 0)));
    salida.set(p, { minutos, compartidos });
  }
  return salida;
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
  parte: ParteDelLote | null,
  minutosSinParte?: MinutosDeParte,
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

  // El material se reparte entre las piezas del conjunto por un % DECLARADO. La suma de
  // los % la valida `partesDelLote`, que es quien los arma: acá ya llegan buenos.
  const proporcion = parte ? parte.porcentajeMaterial / 100 : 1;
  const costoMaterialUnit = (costoMaterialTotal > 0 && base !== null)
    ? dosDecimales((costoMaterialTotal * proporcion) / base.unidades)
    : 0;

  const { minutos, compartidos, comunes = 0 } = parte
    ? parte.minutos
    : minutosSinParte ?? { minutos: await minutosSinImputar(tx, orden), compartidos: 0 };
  const costoMinuto = await calcularCostoMinuto(tx);
  const costoMoUnit = dosDecimales((minutos * costoMinuto) / unidades);

  return {
    costoMaterialUnit,
    costoMoUnit,
    costoUnitario: dosDecimales(costoMaterialUnit + costoMoUnit),
    minutosImputados: dosDecimales(minutos),
    minutosCompartidos: dosDecimales(compartidos),
    minutosComunes: dosDecimales(comunes),
    costoMinuto: dosDecimales(costoMinuto),
    sinCostoMaterial: costoMaterialUnit === 0,
    unidadesBase: base?.unidades ?? 0,
    baseMaterial: base?.origen ?? 'planificado',
  };
}

/**
 * Resuelve las partes con las que va a entrar un ingreso: nombre, SKU de la pieza, % de
 * material y minutos. `[]` si la prenda no se parte.
 *
 * 🔴 Se planta —y **sin ofrecer la casilla**— si al catálogo le falta algo. Los dos
 * frenos son datos que nadie cargó, no decisiones:
 *  - una parte **sin `skuAbrev`** no sabe a qué SKU ingresar, y `stockTerminado.upsert`
 *    crea alegremente la fila que le pidan: un SKU compuesto a medias entra igual y no
 *    se nota hasta que alguien busque esa mercadería y no esté;
 *  - los **% que no suman 100** repartirían el material dejando plata afuera o
 *    inventándola, y el lote lo CONGELA.
 */
export async function partesDelLote(
  tx: Prisma.TransactionClient,
  orden: OrdenParaCostear,
  partesCatalogo: { nombre: string; skuAbrev: string | null; porcentajeMaterial: number | null }[],
  hayMaterial: boolean,
  lotePlan: LotePlanParaCostear | null = null,
): Promise<ParteDelLote[]> {
  if (partesCatalogo.length === 0) return [];

  const sinSku = partesCatalogo.filter((p) => !skuDeParte(orden.sku, p.skuAbrev));
  if (sinSku.length > 0) {
    throw new LoteCorteError(
      `No se puede ingresar ${orden.sku ?? orden.id} por partes: ` +
      `${sinSku.map((p) => p.nombre).join(' y ')} no tiene abreviatura de SKU en el catálogo de conjuntos, ` +
      'así que no hay a qué código ingresar esa pieza.',
      false,
    );
  }

  // El % sólo decide algo si hay material que repartir. Una orden sin ficha de corte
  // entra en $0 igual (afirmándolo), y plantarla acá por un % faltante sería frenarla
  // por un dato que en este ingreso no cambia ningún número.
  if (hayMaterial) {
    const sinPorcentaje = partesCatalogo.filter((p) => p.porcentajeMaterial == null);
    if (sinPorcentaje.length > 0) {
      throw new LoteCorteError(
        `Falta decir qué % del material se lleva cada pieza de ${orden.sku ?? orden.id} ` +
        `(${sinPorcentaje.map((p) => p.nombre).join(', ')}). Cargalo en el catálogo de conjuntos: ` +
        'sin eso el reparto del costo entre corpiño y bombacha sería inventado, y el lote lo congela.',
        false,
      );
    }
    const suma = partesCatalogo.reduce((s, p) => s + (p.porcentajeMaterial ?? 0), 0);
    if (Math.abs(suma - 100) > 0.01) {
      throw new LoteCorteError(
        `Los % de material de las piezas de ${orden.sku ?? orden.id} suman ${suma}%, no 100%: ` +
        'así el corte repartiría de menos o de más. Corregilo en el catálogo de conjuntos.',
        false,
      );
    }
  }

  const nombres = partesCatalogo.map((p) => p.nombre);
  const minutos = lotePlan
    ? await minutosSinImputarDelLote(tx, orden, nombres, lotePlan)
    : await minutosSinImputarPorParte(tx, orden, nombres);

  return partesCatalogo.map((p) => ({
    nombre: p.nombre,
    sku: skuDeParte(orden.sku, p.skuAbrev)!,
    porcentajeMaterial: p.porcentajeMaterial ?? 0,
    minutos: minutos.get(p.nombre) ?? { minutos: 0, compartidos: 0 },
  }));
}

/**
 * Crea el lote con su costo ya congelado. No toca stock ni avíos: de eso se ocupa
 * `terminarCosturaOrden`, que es quien lo llama dentro de su transacción.
 *
 * `numero` viene de afuera a propósito: un ingreso de una prenda por partes crea un lote
 * POR PARTE y los dos son el mismo lote de la orden ("Lote 2 · Corpiño" y "Lote 2 ·
 * Bombacha"). Si cada uno se buscara su propio `max + 1`, el segundo saldría con el
 * número siguiente y la orden parecería haber recibido el doble de lotes.
 */
export async function crearLoteCongelado(
  tx: Prisma.TransactionClient,
  orden: OrdenParaCostear,
  talles: TalleConteo[],
  creadoPor: string,
  permitirSinCosto: boolean,
  parte: ParteDelLote | null,
  numero: number,
  /** El lote planificado en el que entra (null = la orden no está separada). */
  lotePlan: { id: string; minutosSinParte?: MinutosDeParte } | null = null,
) {
  const positivos = talles.filter((t) => t.cantidad > 0);
  const unidades = positivos.reduce((s, t) => s + t.cantidad, 0);
  const costo = await calcularCostoCongelado(tx, orden, unidades, permitirSinCosto, parte, lotePlan?.minutosSinParte);

  return tx.loteCorte.create({
    data: {
      ordenId: orden.id,
      numero,
      parte: parte?.nombre ?? null,
      sku: parte?.sku ?? orden.sku,
      unidades,
      ingresadoPor: creadoPor,
      costoMaterialUnit: costo.costoMaterialUnit,
      costoMoUnit: costo.costoMoUnit,
      costoUnitario: costo.costoUnitario,
      minutosImputados: costo.minutosImputados,
      minutosCompartidos: costo.minutosCompartidos,
      minutosComunes: costo.minutosComunes,
      lotePlanificadoId: lotePlan?.id ?? null,
      costoMinuto: costo.costoMinuto,
      sinCostoMaterial: costo.sinCostoMaterial,
      unidadesBase: costo.unidadesBase,
      baseMaterial: costo.baseMaterial,
      talles: { create: positivos.map((t) => ({ talle: t.talle, cantidad: t.cantidad })) },
    },
    include: { talles: true },
  });
}
