'use client';

import { useState } from 'react';
import { NumInput } from '@/components/ui/NumInput';

interface Cortador {
  id: string;
  nombre: string;
  contacto: string | null;
  tarifaDefault: string | null;
  tarifaModo: string | null;
  notas: string | null;
  activo: boolean;
}

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';

export function CortadoresManager({ initial }: { initial: Cortador[] }) {
  const [cortadores, setCortadores] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Cortador | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [nombre, setNombre]               = useState('');
  const [contacto, setContacto]           = useState('');
  const [tarifaDefault, setTarifaDefault] = useState('');
  const [tarifaModo, setTarifaModo]       = useState<'total' | 'unidad' | ''>('');
  const [notas, setNotas]                 = useState('');

  const resetForm = () => {
    setNombre(''); setContacto(''); setTarifaDefault(''); setTarifaModo(''); setNotas(''); setError('');
  };

  const abrirNuevo = () => { resetForm(); setEditando(null); setShowForm(true); };
  const abrirEdicion = (c: Cortador) => {
    setNombre(c.nombre); setContacto(c.contacto || '');
    setTarifaDefault(c.tarifaDefault ? String(Number(c.tarifaDefault)) : '');
    setTarifaModo((c.tarifaModo as 'total' | 'unidad' | null) || '');
    setNotas(c.notas || '');
    setEditando(c); setShowForm(true); setError('');
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('Nombre obligatorio'); return; }
    setSaving(true); setError('');

    const payload = {
      nombre: nombre.trim(),
      contacto: contacto.trim() || undefined,
      tarifaDefault: tarifaDefault ? Number(tarifaDefault) : undefined,
      tarifaModo: tarifaModo || undefined,
      notas: notas.trim() || undefined,
    };

    const url = editando ? `/api/cortadores/${editando.id}` : '/api/cortadores';
    const method = editando ? 'PUT' : 'POST';

    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (r.ok) {
      const item = await r.json();
      if (editando) setCortadores((prev) => prev.map((p) => p.id === item.id ? item : p));
      else setCortadores((prev) => [...prev, item].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setShowForm(false);
      resetForm();
    } else {
      const d = await r.json();
      setError(d.error || 'Error al guardar');
    }
    setSaving(false);
  };

  const toggleActivo = async (c: Cortador) => {
    const r = await fetch(`/api/cortadores/${c.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !c.activo }),
    });
    if (r.ok) {
      const item = await r.json();
      setCortadores((prev) => prev.map((x) => x.id === item.id ? item : x));
    }
  };

  return (
    <div className="space-y-5">
      {!showForm && (
        <button onClick={abrirNuevo}
          className="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
          + Agregar cortador
        </button>
      )}

      {showForm && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <h3 className="text-sm font-bold text-stone-800 mb-4">{editando ? 'Editar cortador' : 'Nuevo cortador'}</h3>
          <form onSubmit={guardar} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Nombre *</label>
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Contacto</label>
                <input type="text" value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Tel / email" className={inp} />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Tarifa default</label>
                <NumInput value={parseFloat(tarifaDefault) || 0} onChange={(n) => setTarifaDefault(n ? String(n) : '')}
                  min="0" step="0.01" placeholder="Opcional" className={inp} />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Modo de tarifa</label>
                <select value={tarifaModo} onChange={(e) => setTarifaModo(e.target.value as 'total' | 'unidad' | '')} className={inp}>
                  <option value="">--</option>
                  <option value="total">Total</option>
                  <option value="unidad">Por unidad</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Notas</label>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className={`${inp} resize-none`} />
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
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 text-xs font-bold uppercase tracking-widest text-stone-400">
          <span>Nombre</span><span>Contacto</span><span>Tarifa</span><span>Modo</span><span>Estado</span><span />
        </div>
        {cortadores.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-10">Sin cortadores</p>
        ) : (
          cortadores.map((c, i) => (
            <div key={c.id}
              className={`px-5 py-3.5 grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 items-center ${i > 0 ? 'border-t border-stone-100' : ''} ${!c.activo ? 'opacity-50' : ''}`}>
              <p className="text-sm font-medium text-stone-800">{c.nombre}</p>
              <span className="text-xs text-stone-500">{c.contacto || '--'}</span>
              <span className="text-xs text-stone-500 tabular-nums">{c.tarifaDefault ? `$${Number(c.tarifaDefault)}` : '--'}</span>
              <span className="text-xs text-stone-500">{c.tarifaModo || '--'}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                {c.activo ? 'Activo' : 'Inactivo'}
              </span>
              <div className="flex gap-1.5">
                <button onClick={() => abrirEdicion(c)} className="text-xs px-2.5 py-1 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition">Editar</button>
                <button onClick={() => toggleActivo(c)} className="text-xs px-2.5 py-1 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 transition">{c.activo ? 'Desactivar' : 'Activar'}</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
