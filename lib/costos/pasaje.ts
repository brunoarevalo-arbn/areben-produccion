// Pasaje a la marca: lo que el taller (Areben) le entrega a Zattia (o a Stunned) en un
// período. La mercadería sale del stock terminado y para la marca es una COMPRA; su total
// es lo que hay que cargar en el dashboard.
//
// Dos invariantes que sostienen todo:
//  1. El total es NETO (sin IVA) por construcción: el costo del escandallo se arma con
//     precios netos. No hay ninguna división por 1,21 en ningún lado.
//  2. Un movimiento entra a UN pasaje y a ninguno más (`MovimientoTerminado.pasajeId`).
//     Sin ese sello, cerrar dos veces valorizaría la misma mercadería dos veces.
//
// Y una regla: sin escandallo NO hay total. Un SKU sin costear se lista como faltante y
// bloquea el cierre; no se estima ni se rellena con 0.
import { prisma } from '@/lib/prisma';
import { costoPorSku } from '@/lib/costos/costoSku';

export interface SalidaPendiente {
  sku: string;
  talle: string;
  tipo: string;            // 'liso' | 'estampado'
  cantidad: number;        // unidades que salieron (positivo)
  marca: string | null;    // de la OP del SKU; null = no se pudo determinar
  costoUnitario: number | null;
  costoTotal: number | null;
  motivo: string | null;   // por qué no tiene costo, cuando no lo tiene
  movimientoIds: string[];
  desde: Date;
  hasta: Date;
}

export interface GrupoMarca {
  marca: string | null;
  costeadas: SalidaPendiente[];
  sinCosto: SalidaPendiente[];
  unidades: number;
  totalNeto: number;
  desde: Date | null;
  hasta: Date | null;
}

/**
 * Las salidas de producto terminado que todavía no entraron a ningún pasaje, agrupadas por
 * SKU + talle + tipo y valorizadas al escandallo (márgenes congelados: un pasaje es un
 * documento, no una vista viva).
 */
export async function salidasPendientes(): Promise<GrupoMarca[]> {
  const movs = await prisma.movimientoTerminado.findMany({
    where: { origen: 'venta', cantidad: { lt: 0 }, pasajeId: null },
    orderBy: { fecha: 'asc' },
  });
  if (movs.length === 0) return [];

  const skus = [...new Set(movs.map((m) => m.sku))];
  const [costos, ordenes] = await Promise.all([
    costoPorSku(skus, 'congelados'),
    // El SKU es único por OP, así que la OP es la que dice de qué marca es la prenda.
    prisma.ordenProduccion.findMany({ where: { sku: { in: skus } }, select: { sku: true, marca: true } }),
  ]);
  const marcaDeSku = new Map(ordenes.map((o) => [o.sku!, o.marca]));

  const porClave = new Map<string, SalidaPendiente>();
  for (const m of movs) {
    const clave = `${m.sku}|${m.talle}|${m.tipo}`;
    const ya = porClave.get(clave);
    if (ya) {
      ya.cantidad += Math.abs(m.cantidad);
      ya.movimientoIds.push(m.id);
      if (m.fecha < ya.desde) ya.desde = m.fecha;
      if (m.fecha > ya.hasta) ya.hasta = m.fecha;
      continue;
    }
    porClave.set(clave, {
      sku: m.sku, talle: m.talle, tipo: m.tipo,
      cantidad: Math.abs(m.cantidad),
      marca: marcaDeSku.get(m.sku) ?? null,
      costoUnitario: null, costoTotal: null, motivo: null,
      movimientoIds: [m.id], desde: m.fecha, hasta: m.fecha,
    });
  }

  const grupos = new Map<string, GrupoMarca>();
  for (const fila of porClave.values()) {
    // Un estampado no se costea con el escandallo del liso: le falta la estampa. Se dice.
    if (fila.tipo !== 'liso') {
      fila.motivo = 'Es un estampado: su costo se carga en Costos → Productos con estampa.';
    } else {
      const c = costos.get(fila.sku);
      if (c == null) fila.motivo = 'El SKU no tiene escandallo cargado.';
      else { fila.costoUnitario = c; fila.costoTotal = c * fila.cantidad; }
    }

    const key = fila.marca ?? '';
    const g = grupos.get(key) ?? { marca: fila.marca, costeadas: [], sinCosto: [], unidades: 0, totalNeto: 0, desde: null, hasta: null };
    if (fila.costoTotal == null) g.sinCosto.push(fila);
    else { g.costeadas.push(fila); g.unidades += fila.cantidad; g.totalNeto += fila.costoTotal; }
    if (!g.desde || fila.desde < g.desde) g.desde = fila.desde;
    if (!g.hasta || fila.hasta > g.hasta) g.hasta = fila.hasta;
    grupos.set(key, g);
  }

  for (const g of grupos.values()) {
    g.costeadas.sort((a, b) => a.sku.localeCompare(b.sku, 'es') || a.talle.localeCompare(b.talle, 'es'));
    g.sinCosto.sort((a, b) => a.sku.localeCompare(b.sku, 'es') || a.talle.localeCompare(b.talle, 'es'));
  }
  return [...grupos.values()].sort((a, b) => (a.marca ?? '').localeCompare(b.marca ?? '', 'es'));
}

/** El período que le corresponde a un pasaje: el mes de la última salida incluida. */
export function periodoDe(hasta: Date): string {
  return `${hasta.getUTCFullYear()}-${String(hasta.getUTCMonth() + 1).padStart(2, '0')}`;
}
