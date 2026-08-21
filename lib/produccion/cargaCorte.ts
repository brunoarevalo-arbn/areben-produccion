// Armado del prefill del form de carga de corte (tizadas + talles + precio). Lo comparten
// el panel del cortador (/cortador/[ordenId]) y la carga interna del taller
// (GET /api/produccion/cola/[id]/carga-tizada): las dos abren el MISMO formulario, así
// que reabrir lo ya cargado tiene que dar exactamente lo mismo de los dos lados.

import { prisma } from '@/lib/prisma';
import type { CargaCortePrefill, HermanaTizadas } from '@/components/produccion/cortador/CargaCorteForm';

type Ficha = Record<string, unknown> | null;

// Tizadas de un fichaCorteData (propio o de una hermana) → forma del form del cortador.
export function tizadasDeFicha(fd: Ficha): { nombre: string; metros: string; unidades: string }[] {
  return Array.isArray(fd?.tizadas)
    ? (fd.tizadas as Record<string, unknown>[]).map((t) => ({ nombre: String(t.nombre ?? ''), metros: String(t.metros ?? ''), unidades: String(t.unidades ?? '1') }))
    : [];
}

// ¿La ficha la cargó el taller por el cortador (carga interna) o el cortador mismo?
export function esCargaInterna(fd: Ficha): boolean {
  return fd?.cargaInterna === true;
}
export function cargadaPor(fd: Ficha): string | null {
  return typeof fd?.cargadaPor === 'string' ? fd.cargadaPor : null;
}

// `estados` es qué valores de corteEstado se consideran "hay algo que reabrir": el panel
// del cortador solo reabre lo que él dejó 'cargado'; el taller también reabre lo que ya
// quedó 'validado' (para corregir una carga interna que todavía no se pagó).
// `tarifa` es el arranque cuando NO hay nada cargado: la tarifa pactada del cortador.
export function prefillDeOrden(
  orden: { corteEstado: string | null; fichaCorteData: unknown },
  opts: { estados: string[]; tarifa?: { costoCorte: number; modoCosto: 'total' | 'unidad' } | null },
): CargaCortePrefill | undefined {
  const fd = orden.corteEstado && opts.estados.includes(orden.corteEstado) ? (orden.fichaCorteData as Ficha) : null;
  if (fd) {
    return {
      tizadas: tizadasDeFicha(fd),
      talles: (fd.talles && typeof fd.talles === 'object') ? fd.talles as Record<string, string> : {},
      costoCorte: Number(fd.costoCorte) || 0,
      modoCosto: fd.modoCosto === 'unidad' ? 'unidad' : 'total',
      fechaCorte: typeof fd.fechaCorte === 'string' ? fd.fechaCorte : undefined,
    };
  }
  if (opts.tarifa && opts.tarifa.costoCorte > 0) {
    return { tizadas: [], talles: {}, costoCorte: opts.tarifa.costoCorte, modoCosto: opts.tarifa.modoCosto };
  }
  return undefined;
}

// Hermanas del mismo lote con tizadas ya cargadas (validadas por taller o cargadas por
// otro cortador) para poder copiarlas si la moldería es parecida.
export async function hermanasConTizadas(loteId: string | null, ordenId: string): Promise<HermanaTizadas[]> {
  if (!loteId) return [];
  const raw = await prisma.ordenProduccion.findMany({
    where: { loteId, id: { not: ordenId }, OR: [{ fichaCorteCargada: true }, { corteEstado: 'cargado' }, { corteEstado: 'validado' }] },
    select: { id: true, sku: true, fichaCorteData: true },
    orderBy: { createdAt: 'asc' },
  });
  return raw
    .map((h) => ({ id: h.id, sku: h.sku ?? 'S/SKU', tizadas: tizadasDeFicha(h.fichaCorteData as Ficha).filter((t) => (parseFloat(t.metros) || 0) > 0) }))
    .filter((h) => h.tizadas.length > 0);
}
