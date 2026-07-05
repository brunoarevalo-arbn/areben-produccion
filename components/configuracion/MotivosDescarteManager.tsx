'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

interface Motivo {
  id: string;
  nombre: string;
  categoria: string;
  activo: boolean;
}

const CATEGORIAS = ['proveedor', 'corte', 'costura', 'estampa', 'otro'];

const CAT_COLOR: Record<string, string> = {
  proveedor: 'bg-blue-100 text-blue-700',
  corte:     'bg-amber-100 text-amber-700',
  costura:   'bg-emerald-100 text-emerald-700',
  estampa:   'bg-pink-100 text-pink-700',
  otro:      'bg-stone-100 text-stone-500',
};

export function MotivosDescarteManager({ initial }: { initial: Motivo[] }) {
  const [motivos, setMotivos] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Motivo | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [nombre, setNombre]       = useState('');
  const [categoria, setCategoria] = useState('otro');

  const resetForm = () => { setNombre(''); setCategoria('otro'); setError(''); };
  const abrirNuevo = () => { resetForm(); setEditando(null); setShowForm(true); };
  const abrirEdicion = (m: Motivo) => { setNombre(m.nombre); setCategoria(m.categoria); setEditando(m); setShowForm(true); setError(''); };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('Nombre obligatorio'); return; }
    setSaving(true); setError('');

    const payload = { nombre: nombre.trim(), categoria };
    const url = editando ? `/api/motivos-descarte/${editando.id}` : '/api/motivos-descarte';
    const method = editando ? 'PUT' : 'POST';

    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (r.ok) {
      const item = await r.json();
      if (editando) setMotivos((prev) => prev.map((p) => p.id === item.id ? item : p));
      else setMotivos((prev) => [...prev, item].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setShowForm(false);
      resetForm();
    } else {
      const d = await r.json();
      setError(d.error || 'Error');
    }
    setSaving(false);
  };

  const toggleActivo = async (m: Motivo) => {
    const r = await fetch(`/api/motivos-descarte/${m.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !m.activo }),
    });
    if (r.ok) {
      const item = await r.json();
      setMotivos((prev) => prev.map((x) => x.id === item.id ? item : x));
    }
  };

  return (
    <div className="space-y-5">
      {!showForm && (
        <Button onClick={abrirNuevo}>
          + Agregar motivo
        </Button>
      )}

      {showForm && (
        <Card padding="none" className="p-6">
          <h3 className="text-sm font-bold text-stone-800 mb-4">{editando ? 'Editar motivo' : 'Nuevo motivo'}</h3>
          <form onSubmit={guardar} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Nombre *" fullWidth type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Falla de costura" />
              <Select label="Categoria *" fullWidth value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={saving} isLoading={saving}>
                {saving ? 'Guardando...' : editando ? 'Guardar' : 'Agregar'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card padding="none" className="overflow-hidden">
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 grid grid-cols-[1fr_auto_auto_auto] gap-4 text-xs font-bold uppercase tracking-widest text-stone-400">
          <span>Nombre</span><span>Categoria</span><span>Estado</span><span />
        </div>
        {motivos.length === 0 ? (
          <EmptyState message="Sin motivos" />
        ) : (
          motivos.map((m, i) => (
            <div key={m.id}
              className={`px-5 py-3 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center ${i > 0 ? 'border-t border-stone-100' : ''} ${!m.activo ? 'opacity-50' : ''}`}>
              <p className="text-sm font-medium text-stone-800">{m.nombre}</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CAT_COLOR[m.categoria] || ''}`}>{m.categoria}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                {m.activo ? 'Activo' : 'Inactivo'}
              </span>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="sm" onClick={() => abrirEdicion(m)} className="px-2.5 py-1 rounded-lg">Editar</Button>
                <Button variant="secondary" size="sm" onClick={() => toggleActivo(m)} className="px-2.5 py-1 rounded-lg">{m.activo ? 'Desactivar' : 'Activar'}</Button>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
