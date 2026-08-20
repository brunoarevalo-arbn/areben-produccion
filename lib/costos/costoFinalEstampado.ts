// De dónde sale el costo final de un producto con estampa. Son dos fuentes y la
// pantalla tiene que decir SIEMPRE cuál está mostrando:
//   · derivado → liso (escandallo) + DTF + estampería. Manda cuando existe: es vivo.
//   · manual   → un costo ya conocido de la etapa en que no se hacían escandallos.
//                Va con FECHA, porque un número sin fecha al lado se lee como si fuera
//                de hoy — el mismo problema que tiene `gn_ventas`, congelada al 16-jul
//                y presentándose como "últimos 90 días".
// Si no hay ninguna de las dos, el costo es `null`: no se rellena con 0.

export type FuenteCosto = 'escandallo' | 'manual';

export interface CostoFinal {
  total: number | null;
  fuente: FuenteCosto | null;
  fecha: string | null;   // sólo cuando la fuente es manual
  nota: string | null;    // de dónde salió el manual
}

export function resolverCostoFinal(args: {
  derivado: number | null;
  costoFinalManual?: string | number | null;
  costoFinalFecha?: string | Date | null;
  costoFinalFuente?: string | null;
}): CostoFinal {
  if (args.derivado != null) return { total: args.derivado, fuente: 'escandallo', fecha: null, nota: null };
  const manual = args.costoFinalManual == null ? null : Number(args.costoFinalManual);
  if (manual == null || !Number.isFinite(manual)) return { total: null, fuente: null, fecha: null, nota: null };
  const f = args.costoFinalFecha;
  return {
    total: manual,
    fuente: 'manual',
    fecha: f ? (typeof f === 'string' ? f.slice(0, 10) : f.toISOString().slice(0, 10)) : null,
    nota: args.costoFinalFuente?.trim() || null,
  };
}

/** Cómo se muestra la fecha de un costo manual. Sin fecha se dice, no se calla. */
export function etiquetaCostoManual(c: CostoFinal): string {
  if (c.fuente !== 'manual') return '';
  const cuando = c.fecha
    ? new Date(`${c.fecha}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'sin fecha';
  return `cargado a mano · ${cuando}${c.nota ? ` · ${c.nota}` : ''}`;
}
