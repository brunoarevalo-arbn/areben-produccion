'use client';

import { useState } from 'react';

interface Fase {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
}

export function FaseCatalogoManager({ inicial }: { inicial: Fase[] }) {
  const [fases, setFases] = useState<Fase[]>(inicial);

  const refresh = async () => {
    const r = await fetch('/api/fase-catalogo');
    if (r.ok) setFases(await r.json());
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
        {fases.length === 0 && <p className="px-5 py-6 text-center text-xs text-stone-400 italic">Sin fases cargadas</p>}
        {fases.map((f) => (
          <FaseRow key={f.id} fase={f} onChange={refresh} />
        ))}
      </div>
      <NuevaFase onCreated={refresh} ordenSugerido={(fases[fases.length - 1]?.orden ?? 0) + 1} />
    </div>
  );
}

function NuevaFase({ onCreated, ordenSugerido }: { onCreated: () => void; ordenSugerido: number }) {
  const [open,   setOpen]   = useState(false);
  const [nombre, setNombre] = useState('');
  const [orden,  setOrden]  = useState(String(ordenSugerido));
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    const r = await fetch('/api/fase-catalogo', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nombre: nombre.trim(), orden: parseInt(orden) || 0 }),
    });
    if (r.ok) { setNombre(''); setOpen(false); onCreated(); }
    else {
      const data = await r.json().catch(() => ({}));
      setError(typeof data.error === 'string' ? data.error : 'Error al crear');
    }
    setSaving(false);
  };

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setError(null); setOrden(String(ordenSugerido)); }}
        className="bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition">
        + Agregar fase
      </button>
    );
  }

  return (
    <form onSubmit={crear} className="bg-white rounded-2xl border border-stone-200 p-4 flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <label className="text-xs font-semibold text-stone-600 mb-1 block">Nombre</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus
          placeholder="Ej: Pulido"
          className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
      </div>
      <div className="w-24">
        <label className="text-xs font-semibold text-stone-600 mb-1 block">Orden</label>
        <input value={orden} onChange={(e) => setOrden(e.target.value.replace(/\D/g, ''))} required
          className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
      </div>
      <button type="submit" disabled={saving || !nombre.trim()}
        className="bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
        {saving ? '...' : 'Crear'}
      </button>
      <button type="button" onClick={() => { setOpen(false); setNombre(''); setError(null); }}
        className="text-sm px-3 py-2 rounded-lg border border-stone-200 text-stone-500 hover:border-stone-400 transition">
        Cancelar
      </button>
      {error && <p className="basis-full text-xs text-red-600">{error}</p>}
    </form>
  );
}

function FaseRow({ fase, onChange }: { fase: Fase; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [nombre,  setNombre]  = useState(fase.nombre);
  const [orden,   setOrden]   = useState(String(fase.orden));
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const toggle = async () => {
    await fetch(`/api/fase-catalogo/${fase.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ activo: !fase.activo }),
    });
    onChange();
  };

  const guardar = async () => {
    setSaving(true); setError(null);
    const r = await fetch(`/api/fase-catalogo/${fase.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nombre: nombre.trim(), orden: parseInt(orden) || 0 }),
    });
    if (r.ok) { setEditing(false); onChange(); }
    else {
      const data = await r.json().catch(() => ({}));
      setError(typeof data.error === 'string' ? data.error : 'Error al guardar');
    }
    setSaving(false);
  };

  const eliminar = async () => {
    if (!confirm(`¿Eliminar la fase "${fase.nombre}"?`)) return;
    const r = await fetch(`/api/fase-catalogo/${fase.id}`, { method: 'DELETE' });
    if (r.ok) onChange();
    else {
      const data = await r.json().catch(() => ({}));
      alert(typeof data.error === 'string' ? data.error : 'Error al eliminar');
    }
  };

  if (editing) {
    return (
      <div className="px-5 py-3 flex flex-wrap items-end gap-3 bg-violet-50/40">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-stone-500">Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)}
            className="w-full px-2 py-1.5 border border-stone-200 rounded-lg text-sm" />
        </div>
        <div className="w-24">
          <label className="text-xs text-stone-500">Orden</label>
          <input value={orden} onChange={(e) => setOrden(e.target.value.replace(/\D/g, ''))}
            className="w-full px-2 py-1.5 border border-stone-200 rounded-lg text-sm" />
        </div>
        <button onClick={guardar} disabled={saving}
          className="bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition">
          {saving ? '...' : 'Guardar'}
        </button>
        <button onClick={() => { setEditing(false); setNombre(fase.nombre); setOrden(String(fase.orden)); setError(null); }}
          className="text-xs px-3 py-1.5 rounded-lg border border-stone-200 text-stone-500 hover:border-stone-400 transition">
          Cancelar
        </button>
        {error && <p className="basis-full text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className={`px-5 py-3 flex items-center gap-3 ${!fase.activo ? 'opacity-50' : ''}`}>
      <span className="font-mono text-xs font-bold bg-stone-100 text-stone-600 px-2 py-0.5 rounded">{fase.orden}</span>
      <span className="flex-1 text-sm font-medium text-stone-800">{fase.nombre}</span>
      {!fase.activo && <span className="text-xs text-stone-400 italic">inactiva</span>}
      <button onClick={toggle} className="text-xs text-stone-500 hover:text-stone-800 transition">
        {fase.activo ? 'Desactivar' : 'Activar'}
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
