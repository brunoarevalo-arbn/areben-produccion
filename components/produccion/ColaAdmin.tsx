'use client';

import { useState, useEffect, useCallback } from 'react';

interface Orden {
  id: string;
  sku: string;
  descripcion: string | null;
  marca: string;
  cantidad: number;
  estado: string;
  notas: string | null;
  creadoPor: string;
  terminadoAt: string | null;
  createdAt: string;
}

const MARCAS = ['Zattia', 'Stunned'];

const ESTADO_LABEL: Record<string, string> = {
  pendiente:     'Pendiente',
  en_produccion: 'En producción',
  terminado:     'Terminado',
};

const ESTADO_COLOR: Record<string, string> = {
  pendiente:     'bg-amber-100 text-amber-700',
  en_produccion: 'bg-emerald-100 text-emerald-700',
  terminado:     'bg-stone-100 text-stone-500',
};

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function ColaAdmin() {
  const [ordenes, setOrdenes]   = useState<Orden[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filtro,  setFiltro]    = useState<'activos' | 'pendiente' | 'en_produccion' | 'terminado'>('activos');
  const [showForm, setShowForm] = useState(false);

  const [sku,         setSku]         = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [marca,       setMarca]       = useState('Zattia');
  const [cantidad,    setCantidad]    = useState('1');
  const [notas,       setNotas]       = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/produccion/cola');
    if (r.ok) setOrdenes(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim()) return;
    setSaving(true);
    setError('');
    const r = await fetch('/api/produccion/cola', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, descripcion, marca, cantidad, notas }),
    });
    const data = await r.json();
    if (!r.ok) {
      setError(data.error || 'Error al crear');
    } else {
      setOrdenes((prev) => [data, ...prev]);
      setSku(''); setDescripcion(''); setMarca('Zattia'); setCantidad('1'); setNotas('');
      setShowForm(false);
    }
    setSaving(false);
  };

  const cambiarEstado = async (id: string, estado: string) => {
    const r = await fetch(`/api/produccion/cola/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    });
    if (r.ok) {
      const updated = await r.json();
      setOrdenes((prev) => prev.map((o) => o.id === id ? updated : o));
    }
  };

  const eliminar = async (id: string, sku: string) => {
    if (!confirm(`¿Eliminar la orden "${sku}"?`)) return;
    const r = await fetch(`/api/produccion/cola/${id}`, { method: 'DELETE' });
    if (r.ok) setOrdenes((prev) => prev.filter((o) => o.id !== id));
  };

  const filtradas = filtro === 'activos'
    ? ordenes.filter((o) => o.estado !== 'terminado')
    : ordenes.filter((o) => o.estado === filtro);

  const counts = {
    activos:       ordenes.filter((o) => o.estado !== 'terminado').length,
    pendiente:     ordenes.filter((o) => o.estado === 'pendiente').length,
    en_produccion: ordenes.filter((o) => o.estado === 'en_produccion').length,
    terminado:     ordenes.filter((o) => o.estado === 'terminado').length,
  };

  const inputClass = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';

  return (
    <div className="space-y-5">

      {/* Stats + filtros */}
      <div className="flex flex-wrap gap-2">
        {([['activos', 'Activos', counts.activos], ['pendiente', 'Pendientes', counts.pendiente], ['en_produccion', 'En producción', counts.en_produccion], ['terminado', 'Terminados', counts.terminado]] as const).map(([k, label, n]) => (
          <button
            key={k}
            onClick={() => setFiltro(k)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${filtro === k ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'}`}
          >
            {label} <span className={`ml-1 text-xs ${filtro === k ? 'opacity-70' : 'text-stone-400'}`}>{n}</span>
          </button>
        ))}
        <button onClick={cargar} className="ml-auto px-3 py-2 text-xs border border-stone-200 rounded-xl text-stone-500 hover:border-stone-400 transition">
          Actualizar
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 text-xs font-bold uppercase tracking-widest text-stone-400">
          <span>SKU</span>
          <span>Descripción</span>
          <span className="text-center">Cant.</span>
          <span>Estado</span>
          <span />
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-stone-400 text-sm">Cargando...</div>
        ) : filtradas.length === 0 ? (
          <div className="px-5 py-10 text-center text-stone-400 text-sm">Sin órdenes</div>
        ) : (
          filtradas.map((orden, i) => (
            <div
              key={orden.id}
              className={`px-5 py-4 grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center ${i !== 0 ? 'border-t border-stone-100' : ''} ${orden.estado === 'terminado' ? 'opacity-60' : ''}`}
            >
              <span className="font-mono font-bold text-sm bg-stone-100 px-2 py-1 rounded-lg text-stone-700">
                {orden.sku}
              </span>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-stone-800 font-medium truncate">{orden.descripcion || '—'}</p>
                  <span className="text-xs text-stone-400 shrink-0">{orden.marca}</span>
                </div>
                {orden.notas && <p className="text-xs text-stone-400 truncate">{orden.notas}</p>}
                <p className="text-xs text-stone-400">{fechaCorta(orden.createdAt)} · por {orden.creadoPor}</p>
              </div>

              <span className="text-sm font-bold text-stone-700 text-center tabular-nums">{orden.cantidad}</span>

              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${ESTADO_COLOR[orden.estado] ?? 'bg-stone-100 text-stone-500'}`}>
                {ESTADO_LABEL[orden.estado] ?? orden.estado}
              </span>

              <div className="flex gap-1.5 shrink-0">
                {orden.estado === 'pendiente' && (
                  <button onClick={() => cambiarEstado(orden.id, 'en_produccion')}
                    className="text-xs px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition">
                    Iniciar
                  </button>
                )}
                {orden.estado === 'en_produccion' && (
                  <button onClick={() => cambiarEstado(orden.id, 'terminado')}
                    className="text-xs px-2.5 py-1 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50 transition">
                    Terminar
                  </button>
                )}
                {orden.estado === 'terminado' && (
                  <button onClick={() => cambiarEstado(orden.id, 'pendiente')}
                    className="text-xs px-2.5 py-1 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 transition">
                    Reabrir
                  </button>
                )}
                <button onClick={() => eliminar(orden.id, orden.sku)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition">
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Botón agregar */}
      {!showForm && (
        <button onClick={() => setShowForm(true)}
          className="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
          + Agregar a la cola
        </button>
      )}

      {/* Formulario */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5">
          <h3 className="text-sm font-bold text-stone-800 mb-4">Nueva orden de producción</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">SKU <span className="text-red-400">*</span></label>
                <input type="text" value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())}
                  placeholder="Ej: ZATT-TOP-001" className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Marca</label>
                <select value={marca} onChange={(e) => setMarca(e.target.value)} className={inputClass}>
                  {MARCAS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Cantidad</label>
                <input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)}
                  min="1" className={inputClass} />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Descripción</label>
              <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Remera manga corta blanca" className={inputClass} />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Notas internas</label>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)}
                placeholder="Observaciones, prioridad, referencias..." rows={2}
                className={`${inputClass} resize-none`} />
            </div>

            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving || !sku.trim()}
                className="flex-1 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition">
                {saving ? 'Agregando...' : 'Agregar a la cola'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setError(''); }}
                className="px-4 py-2.5 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
