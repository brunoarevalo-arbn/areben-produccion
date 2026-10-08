import type { TableroOrden } from '@/lib/produccion/tablero';

export const pesos = (n: number) => '$ ' + Math.round(n).toLocaleString('es-AR');
export const num = (n: number, d = 0) => n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const horasMin = (min: number) => {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
};
export const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' }) : '—';

const ORDEN_TALLES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
export const ordenarTalles = <T extends { talle: string }>(a: T[]) =>
  [...a].sort((x, y) => (ORDEN_TALLES.indexOf(x.talle) + 1 || 99) - (ORDEN_TALLES.indexOf(y.talle) + 1 || 99) || x.talle.localeCompare(y.talle));

/** Un lote para mostrar: los planificados tal cual, o "Lote único" con todo lo cortado. */
export interface LoteVista { numero: number; unico: boolean; unidades: number; ingresado: number; enTablet: boolean; despuesDe: string | null; motivo: string | null }

export function lotesVista(o: TableroOrden): LoteVista[] {
  if (o.lotes.length > 0) {
    return o.lotes.map((l) => ({ numero: l.numero, unico: false, unidades: l.unidades, ingresado: l.ingresado, enTablet: l.enTaller && !o.enEspera, despuesDe: l.despuesDe, motivo: o.enEspera?.motivo ?? null }));
  }
  return [{ numero: 1, unico: true, unidades: o.cortado, ingresado: o.ingresado, enTablet: !o.enEspera, despuesDe: null, motivo: o.enEspera?.motivo ?? null }];
}

/** Lo que la fila tiene que gritar. `tono`: '' neutro · warn · err. */
export function avisosDe(o: TableroOrden): { tono: '' | 'warn' | 'err'; texto: string }[] {
  const a: { tono: '' | 'warn' | 'err'; texto: string }[] = [];
  if (o.enEspera) a.push({ tono: 'warn', texto: `En espera: ${o.enEspera.motivo ?? 'sin motivo'}` });
  if (o.etapa === 'taller' && o.tiempo.registros === 0) a.push({ tono: 'err', texto: 'Sin minutos registrados' });
  if ((o.tiempo.porParte['Sin pieza'] ?? 0) >= 1 && o.partes.length > 0) a.push({ tono: 'warn', texto: `${num(o.tiempo.porParte['Sin pieza'])} min sin pieza` });
  if (o.cortadoOrigen === 'cortado' && o.plan * 4 < o.cortado) a.push({ tono: 'warn', texto: `Plan ${o.plan} · cortadas ${o.cortado}` });
  if (o.lotes.length > 0 && !o.enEspera && o.lotes.every((l) => !l.enTaller)) a.push({ tono: 'warn', texto: 'Ningún lote en la tablet' });
  if (o.corte.estado === 'cargado') a.push({ tono: 'warn', texto: 'Corte por validar' });
  if (o.avisoCostura) a.push({ tono: '', texto: `${o.avisoCostura.por ?? 'La costurera'} avisó: falta contar` });
  const fallas = o.fallasSinLote + o.lotes.reduce((s, l) => s + l.fallas.reduce((t, f) => t + f.cantidad, 0), 0);
  if (fallas) a.push({ tono: '', texto: `${fallas} falladas` });
  return a;
}

export const CHIP = 'inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11.5px] font-semibold whitespace-nowrap border';
export const CHIP_TONO = {
  '': 'bg-stone-50 border-stone-200 text-stone-700',
  warn: 'bg-orange-50 border-orange-200 text-orange-800',
  err: 'bg-red-50 border-red-200 text-red-700',
  ok: 'bg-emerald-50 border-emerald-200 text-emerald-700',
} as const;
