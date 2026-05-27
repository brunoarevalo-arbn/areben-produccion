'use client';

import { useState } from 'react';

interface Proveedor {
  id: string;
  nombre: string;
  cuit: string | null;
  condicionIva: string | null;
  contacto: string | null;
  notas: string | null;
  activo: boolean;
}

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';

const CONDICIONES_IVA = ['RI', 'MONOTRIBUTO', 'EXENTO', 'NO_RESPONSABLE'];

export function ProveedoresManager({ initial }: { initial: Proveedor[] }) {
  const [proveedores, setProveedores] = useState(initial);
  const [showForm, setShowForm]   = useState(false);
  const [editando, setEditando]   = useState<Proveedor | null>(null);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const [nombre, setNombre]             = useState('');
  const [cuit, setCuit]                 = useState('');
  const [condicionIva, setCondicionIva] = useState('');
  const [contacto, setContacto]         = useState('');
  const [notas, setNotas]               = useState('');

  const resetForm = () => {
    setNombre(''); setCuit(''); setCondicionIva(''); setContacto(''); setNotas('');
    setError('');
  };

  const abrirNuevo = () => {
    resetForm();
    setEditando(null);
    setShowForm(true);
  };

  const abrirEdicion = (p: Proveedor) => {
    setNombre(p.nombre);
    setCuit(p.cuit || '');
    setCondicionIva(p.condicionIva || '');
    setContacto(p.contacto || '');
    setNotas(p.notas || '');
    setEditando(p);
    setShowForm(true);
    setError('');
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('Nombre obligatorio'); return; }
    setSaving(true);
    setError('');

    const payload = {
      nombre: nombre.trim(),
      cuit: cuit.trim() || undefined,
      condicionIva: condicionIva || undefined,
      contacto: contacto.trim() || undefined,
      notas: notas.trim() || undefined,
    };

    const url = editando ? `/api/proveedores/${editando.id}` : '/api/proveedores';
    const method = editando ? 'PUT' : 'POST';

    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (r.ok) {
      const item = await r.json();
      if (editando) {
        setProveedores((prev) => prev.map((p) => p.id === item.id ? item : p));
      } else {
        setProveedores((prev) => [...prev, item].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      }
      setShowForm(false);
      resetForm();
    } else {
      const d = await r.json();
      setError(d.error || 'Error al guardar');
    }
    setSaving(false);
  };

  const toggleActivo = async (p: Proveedor) => {
    const r = await fetch(`/api/proveedores/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !p.activo }),
    });
    if (r.ok) {
      const item = await r.json();
      setProveedores((prev) => prev.map((x) => x.id === item.id ? item : x));
    }
  };

  return (
    <div className="space-y-5">
      {!showForm && (
        <button onClick={abrirNuevo}
          className="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
          + Agregar proveedor
        </button>
      )}

      {showForm && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <h3 className="text-sm font-bold text-stone-800 mb-4">
            {editando ? 'Editar proveedor' : 'Nuevo proveedor'}
          </h3>
          <form onSubmit={guardar} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Nombre *</label>
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">CUIT</label>
                <input type="text" value={cuit} onChange={(e) => setCuit(e.target.value)} placeholder="XX-XXXXXXXX-X" className={inp} />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Condicion IVA</label>
                <select value={condicionIva} onChange={(e) => setCondicionIva(e.target.value)} className={inp}>
                  <option value="">--</option>
                  {CONDICIONES_IVA.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Contacto</label>
                <input type="text" value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Tel / email" className={inp} />
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
                {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar'}
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
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 text-xs font-bold uppercase tracking-widest text-stone-400">
          <span>Nombre</span>
          <span>CUIT</span>
          <span>IVA</span>
          <span>Estado</span>
          <span />
        </div>
        {proveedores.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-10">Sin proveedores</p>
        ) : (
          proveedores.map((p, i) => (
            <div key={p.id}
              className={`px-5 py-3.5 grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center ${i > 0 ? 'border-t border-stone-100' : ''} ${!p.activo ? 'opacity-50' : ''}`}>
              <div>
                <p className="text-sm font-medium text-stone-800">{p.nombre}</p>
                {p.contacto && <p className="text-xs text-stone-400">{p.contacto}</p>}
              </div>
              <span className="text-xs text-stone-500 font-mono">{p.cuit || '--'}</span>
              <span className="text-xs text-stone-500">{p.condicionIva || '--'}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                {p.activo ? 'Activo' : 'Inactivo'}
              </span>
              <div className="flex gap-1.5">
                <button onClick={() => abrirEdicion(p)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition">
                  Editar
                </button>
                <button onClick={() => toggleActivo(p)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 transition">
                  {p.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
