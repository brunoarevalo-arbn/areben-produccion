'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { SkuChip } from '@/components/ui/SkuChip';
import { EmptyState } from '@/components/ui/EmptyState';

interface Orden { id: string; sku: string | null; descripcion: string | null; marca: string; cantidad: number; estado: string; fichaCorteCargada: boolean; }

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente', CORTE: 'En corte', COSTURA: 'En costura', TERMINADO_SIN_ESTAMPA: 'Listo',
  ESTAMPA: 'Estampa', CONTROL_CALIDAD: 'Control', CERRADA: 'Cerrada',
};
const ESTADO_COLOR: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700', CORTE: 'bg-blue-100 text-blue-700', COSTURA: 'bg-violet-100 text-violet-700',
  TERMINADO_SIN_ESTAMPA: 'bg-stone-100 text-stone-600', ESTAMPA: 'bg-pink-100 text-pink-700', CONTROL_CALIDAD: 'bg-yellow-100 text-yellow-700', CERRADA: 'bg-emerald-100 text-emerald-700',
};
const inp = 'px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const norm = (s: string) => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function FichasCorteClient({ ordenes }: { ordenes: Orden[] }) {
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<'todas' | 'sin' | 'con'>('todas');

  const sinFicha = ordenes.filter((o) => !o.fichaCorteCargada).length;

  const lista = useMemo(() => {
    const query = norm(q.trim());
    return ordenes.filter((o) => {
      if (filtro === 'sin' && o.fichaCorteCargada) return false;
      if (filtro === 'con' && !o.fichaCorteCargada) return false;
      if (!query) return true;
      return norm(`${o.sku ?? ''} ${o.descripcion ?? ''} ${o.marca}`).includes(query);
    });
  }, [ordenes, q, filtro]);

  const FILTROS: { v: typeof filtro; label: string }[] = [
    { v: 'todas', label: 'Todas' },
    { v: 'sin', label: `Sin ficha${sinFicha ? ` (${sinFicha})` : ''}` },
    { v: 'con', label: 'Con ficha' },
  ];

  return (
    <div className="space-y-3">
      <Card padding="none" className="p-3 flex flex-wrap items-center gap-3">
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por SKU, descripción o marca…" className={`${inp} flex-1 min-w-[14rem]`} />
        <div className="flex gap-1 bg-stone-100 rounded-xl p-1">
          {FILTROS.map((f) => (
            <button key={f.v} onClick={() => setFiltro(f.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filtro === f.v ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>{f.label}</button>
          ))}
        </div>
        <span className="text-xs text-stone-400 ml-auto whitespace-nowrap">{lista.length} órdenes</span>
      </Card>

      {lista.length === 0 ? (
        <EmptyState message="Sin resultados." />
      ) : (
        <Card padding="none" className="divide-y divide-stone-100">
          {lista.map((o) => (
            <div key={o.id} className="flex items-center gap-3 px-5 py-3">
              <Link href={`/produccion/${o.id}`} className="flex-1 min-w-0 group">
                <div className="flex items-center gap-2 flex-wrap">
                  {o.sku
                    ? <SkuChip sku={o.sku} className="text-stone-700 group-hover:bg-stone-200" />
                    : <span className="text-xs text-stone-400 italic">sin SKU</span>}
                  <span className="text-xs text-stone-400">{o.marca}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ESTADO_COLOR[o.estado] ?? 'bg-stone-100 text-stone-600'}`}>{ESTADO_LABEL[o.estado] ?? o.estado}</span>
                </div>
                {o.descripcion && <p className="text-sm text-stone-600 mt-1 truncate">{o.descripcion}</p>}
              </Link>
              <span className="text-xs text-stone-400 tabular-nums shrink-0">{o.cantidad} u</span>
              {o.fichaCorteCargada ? (
                <Link href={`/produccion/${o.id}/ficha`} className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-semibold transition">📋 Ver ficha</Link>
              ) : (
                <Link href={`/produccion/${o.id}/corte`} className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold transition">Cargar ficha</Link>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
