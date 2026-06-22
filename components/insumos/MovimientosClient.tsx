'use client';

import { useState, useEffect } from 'react';
import { LoadingState } from '@/components/ui/LoadingState';

interface Movimiento {
  id: string;
  tipo: string;
  cantidad: string;
  motivo: string | null;
  usuarioId: string;
  fecha: string;
  reversionNota: string | null;
  rollo: { codigo: string; insumo: { nombre: string } } | null;
  lote:  { codigo: string; insumo: { nombre: string } } | null;
}

const TIPO_COLOR: Record<string, string> = {
  INGRESO:   'bg-emerald-100 text-emerald-700',
  CONSUMO:   'bg-blue-100 text-blue-700',
  AJUSTE:    'bg-amber-100 text-amber-700',
  DESCARTE:  'bg-red-100 text-red-600',
  REVERSION: 'bg-stone-100 text-stone-600',
};

const fmt = (n: string | number) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

function fechaFmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function MovimientosClient() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filtroTipo, setFiltroTipo]   = useState('');

  useEffect(() => {
    const params = filtroTipo ? `?tipo=${filtroTipo}` : '';
    fetch(`/api/insumos/movimientos${params}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setMovimientos)
      .finally(() => setLoading(false));
  }, [filtroTipo]);

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        {['', 'INGRESO', 'CONSUMO', 'AJUSTE', 'DESCARTE', 'REVERSION'].map((t) => (
          <button key={t} onClick={() => { setLoading(true); setFiltroTipo(t); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${filtroTipo === t ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'}`}>
            {t || 'Todos'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto"><div className="min-w-[640px]">
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 grid grid-cols-[auto_auto_1fr_auto_1fr] gap-4 text-xs font-bold uppercase tracking-widest text-stone-400">
          <span>Fecha</span>
          <span>Tipo</span>
          <span>Recurso</span>
          <span className="text-right">Cantidad</span>
          <span>Motivo</span>
        </div>

        {loading ? (
          <LoadingState />
        ) : movimientos.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-10">Sin movimientos</p>
        ) : (
          movimientos.map((m, i) => {
            const recurso = m.rollo
              ? `${m.rollo.codigo} · ${m.rollo.insumo.nombre}`
              : m.lote
              ? `${m.lote.codigo} · ${m.lote.insumo.nombre}`
              : '--';
            return (
              <div key={m.id}
                className={`px-5 py-3 grid grid-cols-[auto_auto_1fr_auto_1fr] gap-4 items-center ${i > 0 ? 'border-t border-stone-100' : ''}`}>
                <span className="text-xs text-stone-500 whitespace-nowrap">{fechaFmt(m.fecha)}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${TIPO_COLOR[m.tipo] || ''}`}>
                  {m.tipo}
                </span>
                <span className="text-sm text-stone-700 truncate">{recurso}</span>
                <span className={`text-sm tabular-nums text-right font-semibold ${Number(m.cantidad) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {Number(m.cantidad) >= 0 ? '+' : ''}{fmt(m.cantidad)}
                </span>
                <span className="text-xs text-stone-500 truncate">{m.motivo || m.reversionNota || '--'}</span>
              </div>
            );
          })
        )}
        </div></div>
      </div>
    </div>
  );
}
