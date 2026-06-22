'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

interface Item { id: string; nombre: string; }

interface Props {
  items: Item[];
  apiBase: string;
  label: string;
  placeholder: string;
}

export function CatalogoManager({ items: initial, apiBase, label, placeholder }: Props) {
  const router = useRouter();
  const [items,   setItems]   = useState<Item[]>(initial);
  const [nuevo,   setNuevo]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [editId,  setEditId]  = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [error,   setError]   = useState('');

  const agregar = async () => {
    if (!nuevo.trim()) return;
    setSaving(true);
    setError('');
    const r = await fetch(apiBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nuevo.trim() }),
    });
    if (r.ok) {
      const item = await r.json() as Item;
      setItems((prev) => [...prev, item].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNuevo('');
      router.refresh();
    } else {
      const d = await r.json() as { error?: string };
      setError(d.error ?? 'Error al guardar');
    }
    setSaving(false);
  };

  const startEdit = (item: Item) => { setEditId(item.id); setEditVal(item.nombre); setError(''); };

  const saveEdit = async () => {
    if (!editId || !editVal.trim()) return;
    setSaving(true);
    setError('');
    const r = await fetch(`${apiBase}/${editId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: editVal.trim() }),
    });
    if (r.ok) {
      const item = await r.json() as Item;
      setItems((prev) => prev.map((i) => i.id === editId ? item : i).sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setEditId(null);
      router.refresh();
    } else {
      const d = await r.json() as { error?: string };
      setError(d.error ?? 'Error al guardar');
    }
    setSaving(false);
  };

  const eliminar = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return;
    const r = await fetch(`${apiBase}/${id}`, { method: 'DELETE' });
    if (r.ok) setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const inp = 'px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';

  return (
    <div className="max-w-lg space-y-5">
      {/* Agregar nuevo */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Agregar {label}</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={nuevo}
            onChange={(e) => { setNuevo(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && agregar()}
            placeholder={placeholder}
            className={`flex-1 ${inp}`}
          />
          <Button
            onClick={agregar}
            disabled={saving || !nuevo.trim()}
          >
            {saving ? '...' : 'Agregar'}
          </Button>
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
        {items.length === 0 && (
          <p className="text-sm text-stone-400 text-center py-10 italic">Sin {label}s todavía</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-5 py-3">
            {editId === item.id ? (
              <>
                <input
                  type="text"
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditId(null); }}
                  autoFocus
                  className={`flex-1 ${inp}`}
                />
                <button onClick={saveEdit} disabled={saving} className="text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold transition disabled:opacity-50">
                  {saving ? '...' : 'Guardar'}
                </button>
                <button onClick={() => setEditId(null)} className="text-xs text-stone-400 hover:text-stone-700 px-1">
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-stone-800">{item.nombre}</span>
                <button onClick={() => startEdit(item)} className="text-xs text-stone-400 hover:text-stone-700 transition px-1">
                  Editar
                </button>
                <button onClick={() => eliminar(item.id, item.nombre)} className="text-xs text-red-400 hover:text-red-600 transition px-1">
                  Eliminar
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
