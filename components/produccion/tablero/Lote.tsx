'use client';

import Link from 'next/link';
import type { TableroOrden } from '@/lib/produccion/tablero';
import type { LoteVista } from './formato';

// Dónde vuelve la etiqueta al imprimir.
const VOLVER = '/produccion?nuevo=1';

export function LoteBoton({ o, l, onLote }: { o: TableroOrden; l: LoteVista; onLote: (o: TableroOrden, l: LoteVista) => void }) {
  const nombre = l.unico ? 'Lote único' : `L${l.numero}`;
  const ayuda = l.enTablet
    ? 'Se ve en la tablet. Click para ocultar.'
    : `Oculto${l.motivo ? `: ${l.motivo}` : ''}${l.despuesDe && l.despuesDe !== 'Corte' ? ` · se separa después de ${l.despuesDe}` : ''}. Click para mostrar.`;
  return (
    <span className={`inline-flex items-stretch h-[30px] rounded-lg overflow-hidden border ${l.enTablet ? 'border-stone-300 bg-white' : 'border-dashed border-stone-300 bg-stone-50'}`}>
      <button type="button" onClick={() => onLote(o, l)} title={ayuda} aria-label={`${nombre}: ${ayuda}`}
        className={`inline-flex items-center gap-1.5 px-2 text-xs font-semibold hover:bg-stone-100 ${l.enTablet ? 'text-emerald-700' : 'text-stone-500'}`}>
        <Ojo abierto={l.enTablet} />
        <span className="text-stone-700">{nombre} · {l.unidades} u</span>
      </button>
      <Link href={`/produccion/${o.id}/lote/${l.numero}/etiqueta?volverA=${encodeURIComponent(VOLVER)}`} title={`Etiqueta del ${nombre}`} aria-label={`Etiqueta del ${nombre}`}
        className="grid place-items-center px-2 border-l border-stone-200 text-stone-500 hover:bg-stone-100 hover:text-stone-900">
        <svg viewBox="0 0 24 24" className="w-[15px] h-[15px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></svg>
      </Link>
    </span>
  );
}

export function Ojo({ abierto }: { abierto: boolean }) {
  return abierto
    ? <svg viewBox="0 0 24 24" className="w-[15px] h-[15px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
    : <svg viewBox="0 0 24 24" className="w-[15px] h-[15px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.5 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>;
}
