'use client';

import { useState } from 'react';

interface Motivo {
  id: string;
  nombre: string;
  categoria: string;
  activo: boolean;
}

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
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
        <button onClick={abrirNuevo}
          className="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
          + Agregar motivo
        </button>
      )}

      {showForm && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <h3 className="text-sm font-bold text-stone-800 mb-4">{editando ? 'Editar motivo' : 'Nuevo motivo'}</h3>
          <form onSubmit={guardar} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Nombre *</label>
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Falla de costura" className={inp} />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Categoria *</label>
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inp}>
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
                {saving ? 'Guardando...' : editando ? 'Guardar' : 'Agregar'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
                className="px-4 py-2.5 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 grid grid-cols-[1fr_auto_auto_auto] gap-4 text-xs font-bold uppercase tracking-widest text-stone-400">
          <span>Nombre</span><span>Categoria</span><span>Estado</span><span />
        </div>
        {motivos.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-10">Sin motivos</p>
        ) : (
          motivos.map((m, i) => (
            <div key={m.id}
              className={`px-5 py-3.5 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center ${i > 0 ? 'border-t border-stone-100' : ''} ${!m.activo ? 'opacity-50' : ''}`}>
              <p className="text-sm font-medium text-stone-800">{m.nombre}</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CAT_COLOR[m.categoria] || ''}`}>{m.categoria}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                {m.activo ? 'Activo' : 'Inactivo'}
              </span>
              <div className="flex gap-1.5">
                <button onClick={() => abrirEdicion(m)} className="text-xs px-2.5 py-1 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition">Editar</button>
                <button onClick={() => toggleActivo(m)} className="text-xs px-2.5 py-1 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 transition">{m.activo ? 'Desactivar' : 'Activar'}</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
