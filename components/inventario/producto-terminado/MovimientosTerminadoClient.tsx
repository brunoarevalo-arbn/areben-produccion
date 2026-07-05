'use client';

import { useState, useEffect, useCallback } from 'react';
import { LoadingState } from '@/components/ui/LoadingState';
import { Card } from '@/components/ui/Card';

interface Mov {
  id: string;
  sku: string;
  talle: string;
  tipo: string;
  cantidad: number;
  origen: string;
  motivo: string | null;
  creadoPor: string;
  fecha: string;
}

const ORIGEN_LABEL: Record<string, string> = {
  produccion: 'Producción', ajuste: 'Ajuste', inicial: 'Carga inicial', merma: 'Merma', venta: 'Venta', estampa: 'Estampa',
};
const ORIGEN_COLOR: Record<string, string> = {
  produccion: 'bg-emerald-100 text-emerald-700', inicial: 'bg-blue-100 text-blue-700',
  ajuste: 'bg-stone-100 text-stone-600', merma: 'bg-amber-100 text-amber-700', venta: 'bg-violet-100 text-violet-700',
};

const fecha = (iso: string) => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const GRID = 'grid grid-cols-[auto_1fr_auto_auto_auto_1fr_auto] gap-3';

export function MovimientosTerminadoClient() {
  const [movs, setMovs] = useState<Mov[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const q = filtro.trim() ? `?sku=${encodeURIComponent(filtro.trim())}` : '';
    const r = await fetch(`/api/produccion/stock-terminado/movimientos${q}`);
    if (r.ok) setMovs(await r.json());
    setLoading(false);
  }, [filtro]);

  useEffect(() => { if (abierto) cargar(); }, [abierto, cargar]);

  return (
    <Card padding="none" className="overflow-hidden">
      <button onClick={() => setAbierto((o) => !o)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-stone-50 transition">
        <span className="text-sm font-bold text-stone-800">Historial de movimientos</span>
        <span className="text-stone-400 text-sm">{abierto ? '▲' : '▼'}</span>
      </button>

      {abierto && (
        <div className="border-t border-stone-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <input type="text" value={filtro} onChange={(e) => setFiltro(e.target.value.toUpperCase())}
              placeholder="Filtrar por SKU…"
              className="px-3 py-2 border border-stone-200 rounded-xl text-sm font-mono focus:outline-none focus:border-amber-400 w-56" />
            <button onClick={cargar} className="text-xs px-3 py-2 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition">Buscar</button>
          </div>

          {loading ? (
            <LoadingState />
          ) : movs.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-6">Sin movimientos.</p>
          ) : (
            <div className="overflow-x-auto"><div className="min-w-[720px]">
              <div className={`px-3 py-2 ${GRID} text-xs font-bold uppercase tracking-widest text-stone-400 border-b border-stone-100`}>
                <span>Fecha</span><span>SKU</span><span>Talle</span><span className="text-right">Cant.</span><span>Origen</span><span>Motivo</span><span>Usuario</span>
              </div>
              {movs.map((m) => (
                <div key={m.id} className={`px-3 py-3 ${GRID} items-center text-sm border-b border-stone-50`}>
                  <span className="text-xs text-stone-400 whitespace-nowrap">{fecha(m.fecha)}</span>
                  <span className="font-mono text-xs text-stone-700">{m.sku}<span className="text-stone-300"> · {m.tipo}</span></span>
                  <span className="text-stone-600">{m.talle}</span>
                  <span className={`text-right tabular-nums font-semibold ${m.cantidad >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {m.cantidad >= 0 ? `+${m.cantidad}` : m.cantidad}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full justify-self-start ${ORIGEN_COLOR[m.origen] || 'bg-stone-100 text-stone-600'}`}>
                    {ORIGEN_LABEL[m.origen] || m.origen}
                  </span>
                  <span className="text-xs text-stone-500 truncate">{m.motivo || '--'}</span>
                  <span className="text-xs text-stone-400 truncate">{m.creadoPor}</span>
                </div>
              ))}
            </div></div>
          )}
        </div>
      )}
    </Card>
  );
}
