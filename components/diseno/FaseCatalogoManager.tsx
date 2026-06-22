'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { toast } from '@/components/ui/Toaster';

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
      <Button onClick={() => { setOpen(true); setError(null); setOrden(String(ordenSugerido)); }}>
        + Agregar fase
      </Button>
    );
  }

  return (
    <form onSubmit={crear} className="bg-white rounded-2xl border border-stone-200 p-4 flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus
          placeholder="Ej: Pulido" fullWidth />
      </div>
      <div className="w-24">
        <Input label="Orden" value={orden} onChange={(e) => setOrden(e.target.value.replace(/\D/g, ''))} required fullWidth />
      </div>
      <Button type="submit" isLoading={saving} disabled={saving || !nombre.trim()}>Crear</Button>
      <Button type="button" variant="secondary" onClick={() => { setOpen(false); setNombre(''); setError(null); }}>
        Cancelar
      </Button>
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
    if (!(await confirmAsync({ message: `¿Eliminar la fase "${fase.nombre}"?`, danger: true, confirmLabel: 'Eliminar' }))) return;
    const r = await fetch(`/api/fase-catalogo/${fase.id}`, { method: 'DELETE' });
    if (r.ok) onChange();
    else {
      const data = await r.json().catch(() => ({}));
      toast.error(typeof data.error === 'string' ? data.error : 'Error al eliminar');
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
        <Button onClick={guardar} isLoading={saving} disabled={saving} size="sm">Guardar</Button>
        <Button onClick={() => { setEditing(false); setNombre(fase.nombre); setOrden(String(fase.orden)); setError(null); }}
          variant="secondary" size="sm">Cancelar</Button>
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
