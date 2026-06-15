'use client';

import { useState, useEffect } from 'react';

interface Item { id: string; sku: string; talle: string; tipo: string; cantidad: number; }
interface Grupo { sku: string; tipo: string; talles: Item[]; total: number; }

export function StockTerminadoClient() {
  const [items, setItems]     = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/produccion/stock-terminado')
      .then((r) => r.ok ? r.json() : [])
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  const grupos: Grupo[] = Object.values(
    items.reduce((acc, it) => {
      const key = `${it.sku}|${it.tipo}`;
      if (!acc[key]) acc[key] = { sku: it.sku, tipo: it.tipo, talles: [], total: 0 };
      acc[key].talles.push(it);
      acc[key].total += it.cantidad;
      return acc;
    }, {} as Record<string, Grupo>),
  );

  if (loading) return <p className="text-stone-400 text-sm text-center py-10">Cargando...</p>;

  if (grupos.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
        <p className="text-stone-400 text-sm">Todavía no hay stock terminado. Sale al terminar la costura de una OP.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {grupos.map((g) => (
        <div key={`${g.sku}|${g.tipo}`} className="bg-white rounded-2xl border border-stone-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm bg-stone-100 px-2 py-1 rounded-lg text-stone-800">{g.sku}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${g.tipo === 'estampado' ? 'bg-pink-100 text-pink-700' : 'bg-violet-100 text-violet-700'}`}>
                {g.tipo}
              </span>
            </div>
            <span className="text-sm text-stone-500">Total: <strong className="text-stone-800 tabular-nums">{g.total}</strong> u</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {g.talles.map((t) => (
              <div key={t.id} className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 text-sm">
                <span className="text-stone-500">{t.talle}:</span> <strong className="text-stone-800 tabular-nums">{t.cantidad}</strong>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
