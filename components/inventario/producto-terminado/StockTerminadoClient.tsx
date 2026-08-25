'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParamState, useParamTexto } from '@/lib/hooks/useParamState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

interface Item { id: string; sku: string; talle: string; tipo: string; cantidad: number; }
interface Grupo { sku: string; tipo: string; talles: Item[]; total: number; }

const inp = 'px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const norm = (s: string) => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function StockTerminadoClient() {
  const [items, setItems]     = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useParamTexto('q');
  const [filtroTipo, setFiltroTipo] = useParamState<'todos' | 'liso' | 'estampado'>('tipo', 'todos');

  useEffect(() => {
    fetch('/api/produccion/stock-terminado')
      .then((r) => r.ok ? r.json() : [])
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  const grupos: Grupo[] = useMemo(() => Object.values(
    items.reduce((acc, it) => {
      const key = `${it.sku}|${it.tipo}`;
      if (!acc[key]) acc[key] = { sku: it.sku, tipo: it.tipo, talles: [], total: 0 };
      acc[key].talles.push(it);
      acc[key].total += it.cantidad;
      return acc;
    }, {} as Record<string, Grupo>),
  ).sort((a, b) => a.sku.localeCompare(b.sku)), [items]);

  const filtrados = useMemo(() => {
    const query = norm(q.trim());
    return grupos.filter((g) => (filtroTipo === 'todos' || g.tipo === filtroTipo) && (!query || norm(g.sku).includes(query)));
  }, [grupos, q, filtroTipo]);

  const totalU = filtrados.reduce((s, g) => s + g.total, 0);

  if (loading) return <LoadingState />;

  if (grupos.length === 0) {
    return (
      <EmptyState message="Todavía no hay stock terminado. Sale al terminar la costura de una OP." />
    );
  }

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <Card padding="none" className="p-3 flex flex-wrap items-center gap-3">
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por SKU…" className={`${inp} flex-1 min-w-[12rem] font-mono`} />
        <div className="flex gap-1 bg-stone-100 rounded-xl p-1">
          {(['todos', 'liso', 'estampado'] as const).map((t) => (
            <button key={t} onClick={() => setFiltroTipo(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${filtroTipo === t ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>{t}</button>
          ))}
        </div>
        <span className="text-xs text-stone-400 ml-auto whitespace-nowrap">{filtrados.length} SKU · {totalU} u</span>
      </Card>

      {filtrados.length === 0 ? (
        <EmptyState message="Sin resultados para el filtro." />
      ) : filtrados.map((g) => (
        <Card key={`${g.sku}|${g.tipo}`} padding="none" className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm bg-stone-100 px-2 py-1 rounded-lg text-stone-800">{g.sku}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${g.tipo === 'estampado' ? 'bg-pink-100 text-pink-700' : 'bg-violet-100 text-violet-700'}`}>{g.tipo}</span>
            </div>
            <span className="text-sm text-stone-500">Total: <strong className="text-stone-800 tabular-nums">{g.total}</strong> u</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {g.talles.sort((a, b) => a.talle.localeCompare(b.talle)).map((t) => (
              <div key={t.id} className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 text-sm">
                <span className="text-stone-500">{t.talle}:</span> <strong className="text-stone-800 tabular-nums">{t.cantidad}</strong>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
