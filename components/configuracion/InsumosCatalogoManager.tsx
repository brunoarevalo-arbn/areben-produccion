'use client';

import { useState } from 'react';

interface InsumoItem {
  id: string;
  nombre: string;
  categoria: string;
  tipoTrazabilidad: string;
  unidadDefault: string;
  stockMinimo: number | null;
  activo: boolean;
}

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';

const CATEGORIAS = ['tela', 'vinilo', 'etiqueta', 'badana', 'hilo', 'aviso', 'packaging', 'otro'];
const UNIDADES = ['kg', 'metro', 'unidad'];

export function InsumosCatalogoManager({ initial }: { initial: InsumoItem[] }) {
  const [insumos, setInsumos]       = useState(initial);
  const [showForm, setShowForm]     = useState(false);
  const [editando, setEditando]     = useState<InsumoItem | null>(null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  const [nombre, setNombre]                   = useState('');
  const [categoria, setCategoria]             = useState('tela');
  const [tipoTrazabilidad, setTipoTrazabilidad] = useState('rollo');
  const [unidadDefault, setUnidadDefault]     = useState('kg');
  const [stockMinimo, setStockMinimo]         = useState('');

  const resetForm = () => {
    setNombre(''); setCategoria('tela'); setTipoTrazabilidad('rollo');
    setUnidadDefault('kg'); setStockMinimo(''); setError('');
  };

  const abrirNuevo = () => { resetForm(); setEditando(null); setShowForm(true); };

  const abrirEdicion = (ins: InsumoItem) => {
    setNombre(ins.nombre);
    setCategoria(ins.categoria);
    setTipoTrazabilidad(ins.tipoTrazabilidad);
    setUnidadDefault(ins.unidadDefault);
    setStockMinimo(ins.stockMinimo != null ? String(ins.stockMinimo) : '');
    setEditando(ins);
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
      categoria,
      tipoTrazabilidad,
      unidadDefault,
      stockMinimo: stockMinimo ? Number(stockMinimo) : undefined,
    };

    const url = editando ? `/api/insumos/${editando.id}` : '/api/insumos';
    const method = editando ? 'PUT' : 'POST';

    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (r.ok) {
      const item = await r.json();
      if (editando) {
        setInsumos((prev) => prev.map((i) => i.id === item.id ? item : i));
      } else {
        setInsumos((prev) => [...prev, item].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      }
      setShowForm(false);
      resetForm();
    } else {
      const d = await r.json();
      setError(d.error || 'Error al guardar');
    }
    setSaving(false);
  };

  const toggleActivo = async (ins: InsumoItem) => {
    const r = await fetch(`/api/insumos/${ins.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !ins.activo }),
    });
    if (r.ok) {
      const item = await r.json();
      setInsumos((prev) => prev.map((x) => x.id === item.id ? item : x));
    }
  };

  const filtrados = filtroCategoria
    ? insumos.filter((i) => i.categoria === filtroCategoria)
    : insumos;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {!showForm && (
          <button onClick={abrirNuevo}
            className="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
            + Agregar insumo
          </button>
        )}
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}
          className="px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400">
          <option value="">Todas las categorias</option>
          {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <h3 className="text-sm font-bold text-stone-800 mb-4">
            {editando ? 'Editar insumo' : 'Nuevo insumo'}
          </h3>
          <form onSubmit={guardar} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Nombre *</label>
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Categoria *</label>
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inp}>
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Trazabilidad *</label>
                <select value={tipoTrazabilidad} onChange={(e) => setTipoTrazabilidad(e.target.value)} className={inp}>
                  <option value="rollo">Rollo (peso individual)</option>
                  <option value="lote">Lote (cantidad total)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Unidad default</label>
                <select value={unidadDefault} onChange={(e) => setUnidadDefault(e.target.value)} className={inp}>
                  {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Stock minimo</label>
                <input type="number" value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)}
                  min="0" step="0.01" placeholder="Opcional" className={inp} />
              </div>
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
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 text-xs font-bold uppercase tracking-widest text-stone-400">
          <span>Nombre</span>
          <span>Categoria</span>
          <span>Trazabilidad</span>
          <span>Unidad</span>
          <span>Estado</span>
          <span />
        </div>
        {filtrados.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-10">Sin insumos</p>
        ) : (
          filtrados.map((ins, i) => (
            <div key={ins.id}
              className={`px-5 py-3.5 grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 items-center ${i > 0 ? 'border-t border-stone-100' : ''} ${!ins.activo ? 'opacity-50' : ''}`}>
              <p className="text-sm font-medium text-stone-800">{ins.nombre}</p>
              <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{ins.categoria}</span>
              <span className="text-xs text-stone-500">{ins.tipoTrazabilidad}</span>
              <span className="text-xs text-stone-500">{ins.unidadDefault}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ins.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                {ins.activo ? 'Activo' : 'Inactivo'}
              </span>
              <div className="flex gap-1.5">
                <button onClick={() => abrirEdicion(ins)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition">
                  Editar
                </button>
                <button onClick={() => toggleActivo(ins)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 transition">
                  {ins.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
