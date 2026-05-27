'use client';

import { useState, useEffect } from 'react';

interface Lote {
  id: string;
  codigo: string;
  cantidadInicial: string;
  cantidadActual: string;
  costoUnitario: string;
  estado: string;
  createdAt: string;
  insumo: { nombre: string; categoria: string; unidadDefault: string };
  compra: { id: string; fecha: string; proveedor: { nombre: string } };
}

const ESTADO_COLOR: Record<string, string> = {
  DISPONIBLE:      'bg-emerald-100 text-emerald-700',
  EN_USO_PARCIAL:  'bg-amber-100 text-amber-700',
  AGOTADO:         'bg-stone-100 text-stone-500',
};

const fmt = (n: string | number) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

export function LotesClient() {
  const [lotes, setLotes]     = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');

  useEffect(() => {
    const params = filtroEstado ? `?estado=${filtroEstado}` : '';
    fetch(`/api/insumos/lotes${params}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setLotes)
      .finally(() => setLoading(false));
  }, [filtroEstado]);

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {['', 'DISPONIBLE', 'EN_USO_PARCIAL', 'AGOTADO'].map((e) => (
          <button key={e} onClick={() => { setLoading(true); setFiltroEstado(e); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${filtroEstado === e ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'}`}>
            {e ? e.replace(/_/g, ' ') : 'Todos'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 text-xs font-bold uppercase tracking-widest text-stone-400">
          <span>Codigo</span>
          <span>Insumo</span>
          <span>Proveedor</span>
          <span className="text-right">Cantidad</span>
          <span className="text-right">$/u</span>
          <span>Estado</span>
        </div>

        {loading ? (
          <p className="text-sm text-stone-400 text-center py-10">Cargando...</p>
        ) : lotes.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-10">Sin lotes</p>
        ) : (
          lotes.map((l, i) => (
            <div key={l.id}
              className={`px-5 py-3 grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center ${i > 0 ? 'border-t border-stone-100' : ''}`}>
              <span className="font-mono font-semibold text-sm text-stone-700">{l.codigo}</span>
              <div className="min-w-0">
                <p className="text-sm text-stone-800 truncate">{l.insumo.nombre}</p>
                <p className="text-xs text-stone-400">{l.insumo.categoria}</p>
              </div>
              <span className="text-xs text-stone-500">{l.compra.proveedor.nombre}</span>
              <span className="text-sm tabular-nums text-right text-stone-700">
                {fmt(l.cantidadActual)} / {fmt(l.cantidadInicial)}
              </span>
              <span className="text-xs tabular-nums text-right text-stone-500">${fmt(l.costoUnitario)}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${ESTADO_COLOR[l.estado] || ''}`}>
                {l.estado.replace(/_/g, ' ')}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
