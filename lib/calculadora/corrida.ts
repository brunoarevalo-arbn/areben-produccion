// Fuente única de verdad de los números de una corrida de muestra: minutos por
// paso, desvíos de máquina, paradas y el estándar que baja al escandallo.
// Puro (sin Prisma) para que lo consuman la ficha, la API de aplicar y la tablet
// sin que ninguno derive su propia versión de la cuenta.
//
// 🔑 Invariante del modelo: el tiempo de una prenda está partido en TRAMOS, y
// cada tramo es o trabajo de un paso (tipo='paso') o un hueco declarado
// (tipo='parada'). Por eso `Σ tramos = tiempo de reloj de la prenda` sale por
// construcción y no hace falta un segundo reloj que reconciliar.
//
// ⚠️ El estándar suma SÓLO los tramos de trabajo. Una parada es tiempo del
// taller y el taller ya está adentro del costoMinuto absorbente
// (lib/costoMinuto.ts): sumarla al paso la contaría dos veces.

export interface MedicionLike {
  id: string;
  pasoId: string | null;
  unidad: number;
  tipo: string;            // 'paso' | 'parada'
  motivo: string | null;
  maquina: string | null;  // la REAL usada
  minutosNetos: number;
  horaFin: string | null;  // null = el tramo está corriendo ahora
}

export interface PasoLike {
  id: string;
  orden: number;
  nombre: string;
  maquina: string;         // la RESPONSABLE, definida en el proceso
  nacidoEnCorrida?: boolean;
}

export interface RepartoMaquina { maquina: string; minutos: number; pct: number }

export interface PasoResumen {
  pasoId: string;
  orden: number;
  nombre: string;
  maquina: string;
  porUnidad: { unidad: number; minutos: number }[];
  minutos: number;         // total de todas las prendas
  promedio: number;        // por prenda, sobre las prendas que lo tienen medido
  porMaquina: RepartoMaquina[];
  desvioPct: number;       // % del tiempo hecho en una máquina distinta a la responsable
  unidadesConDesvio: number;
  unidadesMedidas: number;
  dispersionPct: number;   // (max − min) / promedio, entre prendas
}

export interface UnidadResumen { unidad: number; trabajo: number; paradas: number }
export interface ParadaResumen { motivo: string; minutos: number; veces: number }

export interface Desvio {
  pasoId: string;
  nombre: string;
  maquinaDefinida: string;
  reparto: RepartoMaquina[];
  desvioPct: number;
  unidadesConDesvio: number;
  unidadesMedidas: number;
  /** El desvío se repite en TODAS las prendas medidas ⇒ el paso son dos pasos. */
  sistematico: boolean;
}

export interface ResumenCorrida {
  unidades: UnidadResumen[];
  porPaso: PasoResumen[];
  porMaquina: RepartoMaquina[];
  desvios: Desvio[];
  paradas: ParadaResumen[];
  minutosParadas: number;
  paradasPct: number;
  /** Estándar candidato: minutos de TRABAJO por prenda. */
  promedio: number;
  ultima: number;
  mejor: number;
  /** El tiempo baja de la primera a la última prenda (lo esperado en una muestra). */
  bajando: boolean;
  /** Prendas con al menos un tramo de trabajo cerrado. */
  unidadesMedidas: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Sólo los tramos ya cerrados: el que está corriendo todavía no mide nada. */
export function cerrados(mediciones: MedicionLike[]): MedicionLike[] {
  return mediciones.filter((m) => m.horaFin != null && m.minutosNetos > 0);
}

function reparto(mins: Map<string, number>): RepartoMaquina[] {
  const total = [...mins.values()].reduce((s, n) => s + n, 0);
  return [...mins.entries()]
    .map(([maquina, minutos]) => ({
      maquina,
      minutos: r1(minutos),
      pct: total > 0 ? Math.round((minutos / total) * 100) : 0,
    }))
    .sort((a, b) => b.minutos - a.minutos);
}

export function minutosPorPaso(pasos: PasoLike[], mediciones: MedicionLike[]): PasoResumen[] {
  const trabajo = cerrados(mediciones).filter((m) => m.tipo === 'paso' && m.pasoId);

  return [...pasos]
    .sort((a, b) => a.orden - b.orden)
    .map((p) => {
      const suyas = trabajo.filter((m) => m.pasoId === p.id);

      const porUnidadMap = new Map<number, number>();
      const porMaquinaMap = new Map<string, number>();
      const desvioPorUnidad = new Map<number, number>();
      for (const m of suyas) {
        porUnidadMap.set(m.unidad, (porUnidadMap.get(m.unidad) ?? 0) + m.minutosNetos);
        const maq = m.maquina ?? p.maquina;
        porMaquinaMap.set(maq, (porMaquinaMap.get(maq) ?? 0) + m.minutosNetos);
        if (maq !== p.maquina) {
          desvioPorUnidad.set(m.unidad, (desvioPorUnidad.get(m.unidad) ?? 0) + m.minutosNetos);
        }
      }

      const porUnidad = [...porUnidadMap.entries()]
        .map(([unidad, minutos]) => ({ unidad, minutos: r1(minutos) }))
        .sort((a, b) => a.unidad - b.unidad);

      const minutos = [...porUnidadMap.values()].reduce((s, n) => s + n, 0);
      const unidadesMedidas = porUnidad.length;
      const promedio = unidadesMedidas > 0 ? minutos / unidadesMedidas : 0;
      const minutosDesvio = [...desvioPorUnidad.values()].reduce((s, n) => s + n, 0);

      // Dispersión entre prendas: sin reloj maestro es la única señal indirecta
      // de una parada que no se marcó y quedó adentro del paso.
      const vals = porUnidad.map((u) => u.minutos);
      const dispersion =
        vals.length >= 2 && promedio > 0
          ? ((Math.max(...vals) - Math.min(...vals)) / promedio) * 100
          : 0;

      return {
        pasoId: p.id,
        orden: p.orden,
        nombre: p.nombre,
        maquina: p.maquina,
        porUnidad,
        minutos: r1(minutos),
        promedio: r1(promedio),
        porMaquina: reparto(porMaquinaMap),
        desvioPct: minutos > 0 ? Math.round((minutosDesvio / minutos) * 100) : 0,
        unidadesConDesvio: desvioPorUnidad.size,
        unidadesMedidas,
        dispersionPct: Math.round(dispersion),
      };
    });
}

export function minutosPorUnidad(mediciones: MedicionLike[]): UnidadResumen[] {
  const map = new Map<number, UnidadResumen>();
  for (const m of cerrados(mediciones)) {
    const u = map.get(m.unidad) ?? { unidad: m.unidad, trabajo: 0, paradas: 0 };
    if (m.tipo === 'parada') u.paradas += m.minutosNetos;
    else u.trabajo += m.minutosNetos;
    map.set(m.unidad, u);
  }
  return [...map.values()]
    .map((u) => ({ unidad: u.unidad, trabajo: r1(u.trabajo), paradas: r1(u.paradas) }))
    .sort((a, b) => a.unidad - b.unidad);
}

export function paradasPorMotivo(mediciones: MedicionLike[]): ParadaResumen[] {
  const map = new Map<string, ParadaResumen>();
  for (const m of cerrados(mediciones).filter((x) => x.tipo === 'parada')) {
    const motivo = m.motivo || 'Sin motivo';
    const p = map.get(motivo) ?? { motivo, minutos: 0, veces: 0 };
    p.minutos += m.minutosNetos;
    p.veces += 1;
    map.set(motivo, p);
  }
  return [...map.values()]
    .map((p) => ({ ...p, minutos: r1(p.minutos) }))
    .sort((a, b) => b.minutos - a.minutos);
}

/**
 * Un desvío en 1 de 3 prendas es una anécdota. El MISMO desvío en las 3 dice
 * que ese paso en realidad son dos, y es el hallazgo que audita el proceso.
 */
export function desviosDeMaquina(porPaso: PasoResumen[]): Desvio[] {
  return porPaso
    .filter((p) => p.desvioPct > 0)
    .map((p) => ({
      pasoId: p.pasoId,
      nombre: p.nombre,
      maquinaDefinida: p.maquina,
      reparto: p.porMaquina,
      desvioPct: p.desvioPct,
      unidadesConDesvio: p.unidadesConDesvio,
      unidadesMedidas: p.unidadesMedidas,
      sistematico: p.unidadesMedidas > 0 && p.unidadesConDesvio === p.unidadesMedidas,
    }))
    .sort((a, b) => Number(b.sistematico) - Number(a.sistematico) || b.desvioPct - a.desvioPct);
}

export function resumen(pasos: PasoLike[], mediciones: MedicionLike[]): ResumenCorrida {
  const porPaso = minutosPorPaso(pasos, mediciones);
  const unidades = minutosPorUnidad(mediciones);
  const conTrabajo = unidades.filter((u) => u.trabajo > 0);
  const trabajos = conTrabajo.map((u) => u.trabajo);

  const porMaquinaMap = new Map<string, number>();
  for (const p of porPaso) {
    for (const m of p.porMaquina) {
      porMaquinaMap.set(m.maquina, (porMaquinaMap.get(m.maquina) ?? 0) + m.minutos);
    }
  }

  const paradas = paradasPorMotivo(mediciones);
  const minutosParadas = paradas.reduce((s, p) => s + p.minutos, 0);
  const totalTrabajo = trabajos.reduce((s, n) => s + n, 0);

  return {
    unidades,
    porPaso,
    porMaquina: reparto(porMaquinaMap),
    desvios: desviosDeMaquina(porPaso),
    paradas,
    minutosParadas: r1(minutosParadas),
    paradasPct:
      totalTrabajo + minutosParadas > 0
        ? Math.round((minutosParadas / (totalTrabajo + minutosParadas)) * 100)
        : 0,
    promedio: trabajos.length > 0 ? r1(totalTrabajo / trabajos.length) : 0,
    ultima: trabajos.length > 0 ? trabajos[trabajos.length - 1] : 0,
    mejor: trabajos.length > 0 ? r1(Math.min(...trabajos)) : 0,
    bajando: trabajos.length >= 2 && trabajos[trabajos.length - 1] < trabajos[0],
    unidadesMedidas: trabajos.length,
  };
}

export type ModoEstandar = 'promedio' | 'ultima' | 'mejor';

export function estandar(r: ResumenCorrida, modo: ModoEstandar): number {
  return modo === 'ultima' ? r.ultima : modo === 'mejor' ? r.mejor : r.promedio;
}

/**
 * La secuencia propuesta como proceso al cerrar un relevamiento: los pasos en el
 * orden en que ocurrieron, y para cada uno la máquina en la que MÁS tiempo se
 * trabajó — no la que estaba declarada, que en un relevamiento es sólo la del
 * primer tramo.
 */
export function procesoPropuesto(porPaso: PasoResumen[]): { orden: number; nombre: string; maquina: string }[] {
  return [...porPaso]
    .sort((a, b) => a.orden - b.orden)
    .map((p, i) => ({
      orden: i + 1,
      nombre: p.nombre,
      maquina: p.porMaquina[0]?.maquina ?? p.maquina,
    }));
}


// ─────────────────────────────────────────────────────────────────────────────
// EL TUBO
// La cortacollaretas escupe una tira continua y de ahí salen los cortes EN
// ORDEN: 50 de Bajo Busto, 80 de Bajo Busto, y cuando viene una unión —que no
// puede pasar— se descartan 20 y se sigue.
//
// 🔑 Por eso la merma se MIDE y no se calcula. La fórmula vieja
// (`largoVuelta % largoPieza`) supone un solo largo de pieza repetido; la
// realidad es varios largos intercalados y una unión que cae donde cae.
//
// 🔑 Y el desperdicio NO es de un ribete: cae ENTRE dos cortes. Así que la merma
// medida es del TUBO y le corresponde por igual a todos los ribetes.
// ─────────────────────────────────────────────────────────────────────────────

export interface CorteLike { ribeteId: string | null; unidad: number; orden: number; largoCm: number }
export interface RibeteLike { id: string; nombre: string; anchoCm: number; orden: number }

export interface RibeteResumen {
  ribeteId: string;
  nombre: string;
  anchoCm: number;
  /** cm por prenda: total cortado ÷ prendas que lo cortaron. */
  largoPorPrenda: number;
  totalCm: number;
  unidadesConCorte: number;
  cortes: number;
}

export interface ResumenTubo {
  ribetes: RibeteResumen[];
  utilCm: number;
  desperdicioCm: number;
  totalCm: number;
  /** Merma MEDIDA del tubo, en %: desperdicio ÷ total. Vale para todos los ribetes. */
  mermaPct: number;
  desperdiciosPorUnidad: { unidad: number; cm: number }[];
  unidadesMedidas: number;
}

export function resumenTubo(ribetes: RibeteLike[], cortes: CorteLike[]): ResumenTubo {
  const utiles = cortes.filter((c) => c.ribeteId);
  const basura = cortes.filter((c) => !c.ribeteId);

  const utilCm = utiles.reduce((s, c) => s + c.largoCm, 0);
  const desperdicioCm = basura.reduce((s, c) => s + c.largoCm, 0);
  const totalCm = utilCm + desperdicioCm;

  const porUnidad = new Map<number, number>();
  for (const c of basura) porUnidad.set(c.unidad, (porUnidad.get(c.unidad) ?? 0) + c.largoCm);

  return {
    ribetes: [...ribetes].sort((a, b) => a.orden - b.orden).map((r) => {
      const suyos = utiles.filter((c) => c.ribeteId === r.id);
      const total = suyos.reduce((s, c) => s + c.largoCm, 0);
      const unidades = new Set(suyos.map((c) => c.unidad)).size;
      return {
        ribeteId: r.id, nombre: r.nombre, anchoCm: r.anchoCm,
        largoPorPrenda: unidades > 0 ? r1(total / unidades) : 0,
        totalCm: r1(total), unidadesConCorte: unidades, cortes: suyos.length,
      };
    }),
    utilCm: r1(utilCm),
    desperdicioCm: r1(desperdicioCm),
    totalCm: r1(totalCm),
    // El desperdicio se mide contra el TOTAL que pasó por la máquina, no contra
    // lo útil: es la parte del tubo que se compró y no llegó a la prenda.
    mermaPct: totalCm > 0 ? Math.round((desperdicioCm / totalCm) * 1000) / 10 : 0,
    desperdiciosPorUnidad: [...porUnidad.entries()]
      .map(([unidad, cm]) => ({ unidad, cm: r1(cm) }))
      .sort((a, b) => a.unidad - b.unidad),
    unidadesMedidas: new Set(cortes.map((c) => c.unidad)).size,
  };
}
