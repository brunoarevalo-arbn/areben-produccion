'use client';

import { useState, useEffect, useCallback } from 'react';
import { NumInput } from '@/components/ui/NumInput';
import { AviosCatalogoManager } from '@/components/inventario/AviosCatalogoManager';
import { Button } from '@/components/ui/Button';

interface CostoCorte { id: string; tipoPrenda: string; costo: number; }

function fmt$(n: number) { return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

const inp = 'px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const card = 'bg-white rounded-2xl border border-stone-200';

export function CatalogosCosto() {
  return (
    <div className="space-y-8 max-w-2xl">
      <AviosCatalogoManager />
      <CostosCorteManager />
    </div>
  );
}

function CostosCorteManager() {
  const [items, setItems] = useState<CostoCorte[]>([]);
  const [tipoPrenda, setTipoPrenda] = useState('');
  const [costo, setCosto] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editCosto, setEditCosto] = useState(0);

  const cargar = useCallback(async () => {
    const r = await fetch('/api/costos/costos-corte');
    if (r.ok) setItems((await r.json()).map((x: CostoCorte) => ({ ...x, costo: Number(x.costo) })));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const agregar = async () => {
    if (!tipoPrenda.trim()) return;
    setSaving(true); setError('');
    const r = await fetch('/api/costos/costos-corte', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoPrenda, costo }),
    });
    if (r.ok) { const it = await r.json(); setItems(prev => [...prev, { ...it, costo: Number(it.costo) }].sort((a, b) => a.tipoPrenda.localeCompare(b.tipoPrenda))); setTipoPrenda(''); setCosto(0); }
    else { const d = await r.json(); setError(d.error ?? 'Error al guardar'); }
    setSaving(false);
  };

  const guardarCosto = async (id: string) => {
    const r = await fetch(`/api/costos/costos-corte/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ costo: editCosto }),
    });
    if (r.ok) { const it = await r.json(); setItems(prev => prev.map(x => x.id === id ? { ...it, costo: Number(it.costo) } : x)); setEditId(null); }
  };

  const eliminar = async (id: string, tp: string) => {
    if (!confirm(`¿Eliminar el costo de corte de "${tp}"?`)) return;
    const r = await fetch(`/api/costos/costos-corte/${id}`, { method: 'DELETE' });
    if (r.ok) setItems(prev => prev.filter(x => x.id !== id));
  };

  return (
    <div>
      <h3 className="text-sm font-bold text-stone-800 mb-1">Costos de corte por tipo de prenda</h3>
      <p className="text-xs text-stone-400 mb-4">Costo de referencia por prenda. En el escandallo se sugiere según el tipo de prenda cargado.</p>

      <div className={`${card} divide-y divide-stone-100 mb-3`}>
        {items.length === 0 && <p className="text-sm text-stone-400 text-center py-8 italic">Sin costos cargados</p>}
        {items.map(it => (
          <div key={it.id} className="flex items-center gap-3 px-5 py-3">
            <span className="flex-1 text-sm text-stone-800 capitalize">{it.tipoPrenda}</span>
            {editId === it.id ? (
              <div className="flex items-center gap-2">
                <NumInput value={editCosto} onChange={setEditCosto} min="0" step="0.01" className={`w-28 ${inp}`} autoFocus />
                <button onClick={() => guardarCosto(it.id)} className="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg font-semibold">OK</button>
                <button onClick={() => setEditId(null)} className="text-xs text-stone-400 hover:text-stone-600">✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-stone-900 tabular-nums">{fmt$(it.costo)}</span>
                <button onClick={() => { setEditId(it.id); setEditCosto(it.costo); }}
                  className="text-xs px-2 py-1 border border-stone-200 rounded-lg text-stone-500 hover:border-stone-400 transition">Editar</button>
                <button onClick={() => eliminar(it.id, it.tipoPrenda)}
                  className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition">×</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input type="text" value={tipoPrenda} onChange={e => { setTipoPrenda(e.target.value); setError(''); }}
          placeholder="Tipo de prenda (ej: Remera)" className={`flex-1 ${inp}`} />
        <NumInput value={costo} onChange={setCosto} placeholder="$ costo" min="0" step="0.01" className={`w-28 ${inp}`} />
        <Button onClick={agregar} disabled={saving || !tipoPrenda.trim()}>+ Agregar</Button>
      </div>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
