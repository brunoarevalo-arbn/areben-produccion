'use client';

import { useState } from 'react';
import { confirmAsync } from '@/components/ui/ConfirmProvider';

interface Entry {
  id: string;
  categoria: string;
  nombre: string;
  abreviatura: string;
  orden: number;
  activo: boolean;
  createdAt: string;
}

const CATEGORIAS = [
  { id: 'marca',  label: 'Marcas',          color: 'border-violet-300 bg-violet-50/40' },
  { id: 'prenda', label: 'Tipos de prenda', color: 'border-amber-300  bg-amber-50/40'  },
  { id: 'color',  label: 'Colores',         color: 'border-stone-300  bg-stone-50'      },
] as const;

export function CatalogoSkuManager({ inicial }: { inicial: Entry[] }) {
  const [entries, setEntries] = useState<Entry[]>(inicial);

  const refresh = async () => {
    const r = await fetch('/api/sku-catalogo');
    if (r.ok) setEntries(await r.json());
  };

  return (
    <div className="space-y-6">
      {CATEGORIAS.map((cat) => (
        <CategoriaSection
          key={cat.id}
          categoria={cat.id}
          label={cat.label}
          color={cat.color}
          entries={entries.filter((e) => e.categoria === cat.id)}
          onChange={refresh}
        />
      ))}
    </div>
  );
}

function CategoriaSection({
  categoria, label, color, entries, onChange,
}: {
  categoria: string; label: string; color: string;
  entries: Entry[]; onChange: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [nombre,   setNombre]   = useState('');
  const [abrev,    setAbrev]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    const r = await fetch('/api/sku-catalogo', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        categoria,
        nombre: nombre.trim(),
        abreviatura: abrev.trim().toUpperCase(),
      }),
    });
    if (r.ok) {
      setNombre(''); setAbrev(''); setShowForm(false);
      onChange();
    } else {
      const data = await r.json().catch(() => ({}));
      setError(typeof data.error === 'string' ? data.error : 'Error al crear');
    }
    setSaving(false);
  };

  return (
    <div className={`rounded-2xl border-2 ${color} overflow-hidden`}>
      <div className="px-5 py-3 flex items-center justify-between border-b border-stone-200/60">
        <h2 className="text-sm font-bold text-stone-800">{label}</h2>
        <span className="text-xs text-stone-400">{entries.length}</span>
      </div>

      <div className="divide-y divide-stone-200/60 bg-white">
        {entries.map((e) => (
          <EntryRow key={e.id} entry={e} onChange={onChange} />
        ))}
        {entries.length === 0 && (
          <p className="px-5 py-6 text-center text-xs text-stone-400 italic">Sin opciones cargadas</p>
        )}
      </div>

      <div className="bg-white px-4 py-3 border-t border-stone-200/60">
        {!showForm ? (
          <button onClick={() => { setShowForm(true); setError(null); }}
            className="text-xs px-3 py-1.5 rounded-lg border border-stone-300 text-stone-600 hover:border-stone-500 transition">
            + Agregar
          </button>
        ) : (
          <form onSubmit={crear} className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-stone-500">Nombre</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required
                className="w-full px-2 py-1.5 border border-stone-200 rounded-lg text-sm" />
            </div>
            <div className="w-28">
              <label className="text-xs text-stone-500">Abrev.</label>
              <input value={abrev} onChange={(e) => setAbrev(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                required maxLength={8}
                className="w-full px-2 py-1.5 border border-stone-200 rounded-lg text-sm font-mono" />
            </div>
            <button type="submit" disabled={saving || !nombre.trim() || !abrev.trim()}
              className="bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition">
              {saving ? '...' : 'Crear'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError(null); }}
              className="text-xs px-3 py-1.5 rounded-lg border border-stone-200 text-stone-500 hover:border-stone-400 transition">
              Cancelar
            </button>
            {error && <p className="basis-full text-xs text-red-600">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}

function EntryRow({ entry, onChange }: { entry: Entry; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [nombre,  setNombre]  = useState(entry.nombre);
  const [abrev,   setAbrev]   = useState(entry.abreviatura);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const toggle = async () => {
    await fetch(`/api/sku-catalogo/${entry.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ activo: !entry.activo }),
    });
    onChange();
  };

  const guardar = async () => {
    setSaving(true); setError(null);
    const r = await fetch(`/api/sku-catalogo/${entry.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nombre: nombre.trim(), abreviatura: abrev.trim().toUpperCase() }),
    });
    if (r.ok) { setEditing(false); onChange(); }
    else {
      const data = await r.json().catch(() => ({}));
      setError(typeof data.error === 'string' ? data.error : 'Error al guardar');
    }
    setSaving(false);
  };

  const eliminar = async () => {
    if (!(await confirmAsync(`¿Eliminar "${entry.nombre}"? Si ya hay órdenes que usan esta abreviatura, se mantienen pero no se podrán generar nuevas con esta opción.`))) return;
    await fetch(`/api/sku-catalogo/${entry.id}`, { method: 'DELETE' });
    onChange();
  };

  if (editing) {
    return (
      <div className="px-5 py-3 flex flex-wrap items-end gap-2 bg-amber-50/40">
        <div className="flex-1 min-w-[140px]">
          <label className="text-xs text-stone-500">Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)}
            className="w-full px-2 py-1.5 border border-stone-200 rounded-lg text-sm" />
        </div>
        <div className="w-28">
          <label className="text-xs text-stone-500">Abrev.</label>
          <input value={abrev} onChange={(e) => setAbrev(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            maxLength={8} className="w-full px-2 py-1.5 border border-stone-200 rounded-lg text-sm font-mono" />
        </div>
        <button onClick={guardar} disabled={saving}
          className="bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition">
          {saving ? '...' : 'Guardar'}
        </button>
        <button onClick={() => { setEditing(false); setNombre(entry.nombre); setAbrev(entry.abreviatura); setError(null); }}
          className="text-xs px-3 py-1.5 rounded-lg border border-stone-200 text-stone-500 hover:border-stone-400 transition">
          Cancelar
        </button>
        {error && <p className="basis-full text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className={`px-5 py-3 flex items-center gap-3 ${!entry.activo ? 'opacity-50' : ''}`}>
      <span className="font-mono text-xs font-bold bg-stone-100 text-stone-700 px-2 py-0.5 rounded">{entry.abreviatura}</span>
      <span className="flex-1 text-sm text-stone-800">{entry.nombre}</span>
      {!entry.activo && <span className="text-xs text-stone-400 italic">inactivo</span>}
      <button onClick={toggle} className="text-xs text-stone-500 hover:text-stone-800 transition">
        {entry.activo ? 'Desactivar' : 'Activar'}
      </button>
      <button onClick={() => setEditing(true)} className="text-xs text-stone-500 hover:text-stone-800 transition">
        Editar
      </button>
      <button onClick={eliminar} className="text-xs text-red-500 hover:text-red-700 transition">
        Eliminar
      </button>
    </div>
  );
}
