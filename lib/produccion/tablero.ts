import type { Prisma, PrismaClient } from '@prisma/client';
import { baseDeRepartoConOrigen, cantidadCortada, cantidadIngresadaPorPartes, ingresadasPorOrden, tallesCortados } from './cantidades';
import { conjuntosActivos, partesDeSku, skuDeParte } from './conjuntos';
import { estadoDeLotes, lotesParaPantalla, type LotePlanificadoDTO } from './lotesPlanificados';
import { registrosDeCosturaPorSku } from './loteCorte';
import { cuentaPorCortador } from './cuenta-cortador';
import { calcularCostoMinuto } from '@/lib/costoMinuto';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Lo que el tablero de Producción › Órdenes muestra, armado en el servidor.
 *
 * 🔑 Las etapas son las que el taller usa de verdad, no los 7 estados del enum: de esos
 * se usan PENDIENTE, COSTURA y CERRADA (8-oct: 65 cerradas y 8 en costura). Los estados
 * "Listo" (TERMINADO_SIN_ESTAMPA · ESTAMPA · CONTROL_CALIDAD) caen en «Para cerrar».
 * El enum no se toca.
 *
 * 🔴 `conValores = false` (sin permiso `costos`): los montos NO SE ARMAN. No alcanza con
 * esconderlos en la pantalla, porque viajarían igual en la respuesta.
 */
export type Etapa = 'corte' | 'taller' | 'frenada' | 'paraCerrar';

export interface TiempoDeOrden {
  minutos: number;
  registros: number;
  ultimo: string | null;
  porMaquina: Record<string, number>;
  porParte: Record<string, number>;
  /** Clave `'sin lote'` o el número de lote planificado. */
  porLote: Record<string, number>;
}

export interface CostosDeOrden {
  /** Tela + insumos secundarios del corte, como en `telaUnit`. */
  tela: number;
  sublimacion: number;
  corte: number;
  manoDeObra: number;
  total: number;
  /** Sin ficha de tela el costo de la tela es 0 porque NADIE LO CARGÓ, no porque sea gratis. */
  telaCargada: boolean;
}

export interface TableroOrden {
  id: string;
  sku: string | null;
  descripcion: string | null;
  color: string;
  marca: string;
  estado: string;
  etapa: Etapa;
  loteId: string | null;
  creadaAt: string;
  plan: number;
  cortado: number;
  /** `'planificado'` cuando nadie cargó lo cortado y el número es el plan. */
  cortadoOrigen: 'cortado' | 'planificado';
  ingresado: number;
  talles: { talle: string; cantidad: number }[] | null;
  partes: string[];
  corte: { estado: string | null; cortador: string | null; cortadorId: string | null; fecha: string | null; fichaTela: boolean; monto?: number };
  enEspera: { desde: string; motivo: string | null } | null;
  avisoCostura: { at: string; por: string | null } | null;
  lotes: LotePlanificadoDTO[];
  /** Fallas del corte entero (sin lote), por pieza. */
  fallasSinLote: number;
  tiempo: TiempoDeOrden;
  costos?: CostosDeOrden;
  transiciones: { fecha: string; estado: string; notas: string | null }[];
}

export interface TableroArticulo {
  id: string;
  nombre: string;
  marca: string;
  etapa: Etapa;
  ordenes: TableroOrden[];
}

export interface Tablero {
  conValores: boolean;
  costoMinuto?: number;
  articulos: TableroArticulo[];
  cortadores?: { id: string; nombre: string; saldo: number }[];
  cerradas: { total: number; ultimas: { id: string; sku: string | null; descripcion: string | null; terminadaAt: string | null; cortado: number; costoTotal?: number }[] };
}

const ORDEN_ETAPA: Etapa[] = ['corte', 'taller', 'paraCerrar', 'frenada'];

function etapaDe(o: { estado: string; enEsperaDesde: Date | null }): Etapa {
  if (o.enEsperaDesde) return 'frenada';
  if (o.estado === 'PENDIENTE' || o.estado === 'CORTE') return 'corte';
  if (o.estado === 'COSTURA') return 'taller';
  return 'paraCerrar';
}

/** "Bikini AYLA … · Rayas rosas y rojas" → ["Bikini AYLA …", "Rayas rosas y rojas"]. */
function partirDescripcion(d: string | null): [string | null, string | null] {
  if (!d) return [null, null];
  const i = d.lastIndexOf(' · ');
  return i < 0 ? [d.trim(), null] : [d.slice(0, i).trim(), d.slice(i + 3).trim()];
}

const sumar = (m: Record<string, number>, k: string, v: number) => { m[k] = (m[k] ?? 0) + v; };

export async function cargarTablero(db: Db, { conValores }: { conValores: boolean }): Promise<Tablero> {
  const [abiertas, totalCerradas, ultimasCerradas, colores, conjuntos] = await Promise.all([
    db.ordenProduccion.findMany({
      where: { estado: { not: 'CERRADA' } },
      orderBy: { createdAt: 'asc' },
      include: {
        lote: { select: { id: true, descripcion: true, marca: true } },
        cortesPorTalle: { select: { talle: true, cantidad: true } },
        lotesPlanificados: { select: { id: true } },
        fallas: { where: { loteId: null }, select: { cantidad: true } },
        transiciones: { orderBy: { fecha: 'desc' }, take: 12, select: { fecha: true, estadoNuevo: true, notas: true } },
      },
    }),
    db.ordenProduccion.count({ where: { estado: 'CERRADA' } }),
    db.ordenProduccion.findMany({
      where: { estado: 'CERRADA' },
      orderBy: [{ terminadoAt: 'desc' }, { createdAt: 'desc' }],
      take: 40,
      select: { id: true, sku: true, descripcion: true, terminadoAt: true, cantidad: true, cantidadCortada: true, costoTotal: true },
    }),
    db.skuCatalogo.findMany({ where: { categoria: 'color' }, select: { abreviatura: true, nombre: true } }),
    conjuntosActivos(),
  ]);

  const skus = abiertas.map((o) => o.sku).filter((s): s is string => !!s);
  const [ingresadas, registros, costoMinuto, cuentas, lotesPorOrden] = await Promise.all([
    ingresadasPorOrden(db, abiertas.map((o) => o.id)),
    registrosDeCosturaPorSku(db, skus),
    conValores ? calcularCostoMinuto(db) : Promise.resolve(0),
    conValores ? cuentaPorCortador() : Promise.resolve(null),
    Promise.all(abiertas.map(async (o) => [o.id, o.lotesPlanificados.length > 0 ? lotesParaPantalla(await estadoDeLotes(db, o)) : []] as const)),
  ]);
  const lotesDe = new Map(lotesPorOrden);
  const nombreColor = new Map(colores.map((c) => [c.abreviatura.toUpperCase(), c.nombre]));

  const ordenes: TableroOrden[] = [];
  for (const o of abiertas) {
    const partes = partesDeSku(o.sku, conjuntos);
    // En una prenda por partes lo ingresado es la pieza que MENOS entró: 40 corpiños y 39
    // bombachas son 39 bikinis.
    const skusPartes = partes.map((p) => skuDeParte(o.sku, p.skuAbrev)).filter((s): s is string => !!s);
    const ingresado = skusPartes.length > 0 && skusPartes.length === partes.length
      ? await cantidadIngresadaPorPartes(db, o.id, skusPartes)
      : ingresadas.get(o.id) ?? 0;

    const tiempo: TiempoDeOrden = { minutos: 0, registros: 0, ultimo: null, porMaquina: {}, porParte: {}, porLote: {} };
    for (const r of (o.sku && registros.get(o.sku.trim())) || []) {
      tiempo.minutos += r.minutosNetos;
      tiempo.registros++;
      if (!tiempo.ultimo || r.fecha > tiempo.ultimo) tiempo.ultimo = r.fecha;
      sumar(tiempo.porMaquina, r.maquina || 'Sin máquina', r.minutosNetos);
      sumar(tiempo.porParte, r.parte || 'Sin pieza', r.minutosNetos);
      sumar(tiempo.porLote, r.lote == null ? 'sin lote' : String(r.lote), r.minutosNetos);
    }

    const [modelo, colorDesc] = partirDescripcion(o.descripcion);
    const abrevColor = o.sku?.split('-')[2]?.toUpperCase() ?? '';
    const origen = baseDeRepartoConOrigen(o)?.origen ?? 'planificado';

    const fila: TableroOrden = {
      id: o.id,
      sku: o.sku,
      descripcion: modelo,
      color: colorDesc ?? nombreColor.get(abrevColor) ?? (abrevColor || 'Sin color'),
      marca: o.marca,
      estado: o.estado,
      etapa: etapaDe(o),
      loteId: o.loteId,
      creadaAt: o.createdAt.toISOString(),
      plan: o.cantidad,
      cortado: cantidadCortada(o),
      cortadoOrigen: origen,
      ingresado,
      talles: tallesCortados(o),
      partes: partes.map((p) => p.nombre),
      corte: {
        estado: o.corteEstado, cortador: o.cortador, cortadorId: o.cortadorId,
        fecha: o.fechaCorte?.toISOString() ?? null, fichaTela: o.fichaCorteCargada,
        ...(conValores ? { monto: Number(o.costoCorte) } : {}),
      },
      enEspera: o.enEsperaDesde ? { desde: o.enEsperaDesde.toISOString(), motivo: o.enEsperaMotivo } : null,
      avisoCostura: o.avisoCosturaAt ? { at: o.avisoCosturaAt.toISOString(), por: o.avisoCosturaPor } : null,
      lotes: lotesDe.get(o.id) ?? [],
      fallasSinLote: o.fallas.reduce((s, f) => s + f.cantidad, 0),
      tiempo,
      transiciones: o.transiciones.map((t) => ({ fecha: t.fecha.toISOString(), estado: t.estadoNuevo, notas: t.notas })),
    };
    if (conValores) {
      const tela = Number(o.costoTela) + Number(o.costoInsumosSecundarios);
      const sublimacion = Number(o.costoSublimacion);
      const corte = Number(o.costoCorte);
      const manoDeObra = tiempo.minutos * costoMinuto;
      fila.costos = { tela, sublimacion, corte, manoDeObra, total: tela + sublimacion + corte + manoDeObra, telaCargada: o.fichaCorteCargada };
    }
    ordenes.push(fila);
  }

  // Un artículo es el LoteProduccion (los colores del mismo molde); una orden suelta es su propio artículo.
  const articulos = new Map<string, TableroArticulo>();
  for (const [i, o] of ordenes.entries()) {
    const fuente = abiertas[i];
    const id = fuente.loteId ?? `orden:${o.id}`;
    if (!articulos.has(id)) {
      articulos.set(id, { id, nombre: partirDescripcion(fuente.lote?.descripcion ?? null)[0] ?? o.descripcion ?? o.sku ?? 'Sin nombre', marca: fuente.lote?.marca ?? o.marca, etapa: o.etapa, ordenes: [] });
    }
    articulos.get(id)!.ordenes.push(o);
  }
  for (const a of articulos.values()) {
    // Frenado sólo si están frenados TODOS sus colores; si no, la etapa más temprana que tenga.
    const etapas = a.ordenes.map((o) => o.etapa);
    a.etapa = etapas.every((e) => e === 'frenada')
      ? 'frenada'
      : ORDEN_ETAPA.find((e) => e !== 'frenada' && etapas.includes(e)) ?? 'taller';
  }

  const cortadorIds = [...new Set(ordenes.map((o) => o.corte.cortadorId).filter((c): c is string => !!c))];
  const cortadores = cuentas
    ? (await db.cortador.findMany({ where: { id: { in: cortadorIds } }, select: { id: true, nombre: true } }))
      .map((c) => ({ id: c.id, nombre: c.nombre, saldo: cuentas.get(c.id)?.saldo ?? 0 }))
    : undefined;

  return {
    conValores,
    ...(conValores ? { costoMinuto } : {}),
    articulos: [...articulos.values()],
    ...(cortadores ? { cortadores } : {}),
    cerradas: {
      total: totalCerradas,
      ultimas: ultimasCerradas.map((c) => ({
        id: c.id, sku: c.sku, descripcion: c.descripcion, terminadaAt: c.terminadoAt?.toISOString() ?? null,
        cortado: cantidadCortada(c), ...(conValores ? { costoTotal: Number(c.costoTotal) } : {}),
      })),
    },
  };
}
