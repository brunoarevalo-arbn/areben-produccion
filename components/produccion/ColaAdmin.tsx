'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { NumInput } from '@/components/ui/NumInput';

interface Transicion { fecha: string; estadoNuevo: string; }

interface Orden {
  id: string;
  sku: string;
  descripcion: string | null;
  marca: string;
  cantidad: number;
  estado: string;
  fichaCorteCargada: boolean;
  costoTotal: string;
  notas: string | null;
  creadoPor: string;
  terminadoAt: string | null;
  createdAt: string;
  transiciones: Transicion[];
}

interface CatalogoEntry {
  id: string;
  categoria: 'marca' | 'prenda' | 'color';
  nombre: string;
  abreviatura: string;
  activo: boolean;
}

const ESTADOS = ['PENDIENTE', 'CORTE', 'COSTURA', 'TERMINADO_SIN_ESTAMPA', 'ESTAMPA', 'CONTROL_CALIDAD', 'CERRADA'] as const;

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE:             'Pendiente',
  CORTE:                 'Corte',
  COSTURA:               'Costura',
  TERMINADO_SIN_ESTAMPA: 'Liso terminado',
  ESTAMPA:               'Estampa',
  CONTROL_CALIDAD:       'Control calidad',
  CERRADA:               'Cerrada',
};

const ESTADO_COLOR: Record<string, string> = {
  PENDIENTE:             'bg-amber-100 text-amber-700',
  CORTE:                 'bg-blue-100 text-blue-700',
  COSTURA:               'bg-emerald-100 text-emerald-700',
  TERMINADO_SIN_ESTAMPA: 'bg-violet-100 text-violet-700',
  ESTAMPA:               'bg-pink-100 text-pink-700',
  CONTROL_CALIDAD:       'bg-orange-100 text-orange-700',
  CERRADA:               'bg-stone-100 text-stone-500',
};

// Flujo de producción: termina en TERMINADO_SIN_ESTAMPA ("liso terminado").
const ESTADO_SIGUIENTE: Record<string, string[]> = {
  PENDIENTE:             ['CORTE', 'COSTURA'],   // se puede saltar a costura si el corte ya está
  CORTE:                 ['COSTURA'],
  COSTURA:               ['TERMINADO_SIN_ESTAMPA'],
  TERMINADO_SIN_ESTAMPA: [],
  ESTAMPA:               [],
  CONTROL_CALIDAD:       [],
  CERRADA:               [],
};

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function diasEnEstado(transiciones: Transicion[]): number {
  if (transiciones.length === 0) return 0;
  const ultima = new Date(transiciones[0].fecha);
  return Math.floor((Date.now() - ultima.getTime()) / 86400000);
}

const fmt = (n: string | number) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });

export function ColaAdmin() {
  const [ordenes, setOrdenes]   = useState<Orden[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filtro, setFiltro]     = useState<string>('activos');
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Orden | null>(null);
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editCantidad, setEditCantidad]       = useState('1');
  const [editNotas, setEditNotas]             = useState('');
  const [editSaving, setEditSaving]           = useState(false);
  const [editError, setEditError]             = useState('');

  const [catalogo, setCatalogo]       = useState<CatalogoEntry[]>([]);
  const [marcaAbrev, setMarcaAbrev]   = useState('');
  const [prendaAbrev, setPrendaAbrev] = useState('');
  const [colorAbrev, setColorAbrev]   = useState('');
  const [skuSugerido, setSkuSugerido] = useState<string | null>(null);
  const [loadingSku, setLoadingSku]   = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad]       = useState('1');
  const [notas, setNotas]             = useState('');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  // Estado change
  const [cambioId, setCambioId]       = useState<string | null>(null);
  const [cambioNotas, setCambioNotas] = useState('');

  // Mini-modal de SKU (al mandar a costura una OP sin SKU)
  const [skuModalOrden, setSkuModalOrden] = useState<Orden | null>(null);
  const [skuPrenda,     setSkuPrenda]     = useState('');
  const [skuColor,      setSkuColor]      = useState('');
  const [skuSaving,     setSkuSaving]     = useState(false);
  const [skuModalError, setSkuModalError] = useState('');

  // Modal terminar costura (conteo por talle → stock de terminados)
  const [terminarOrden,  setTerminarOrden]  = useState<Orden | null>(null);
  const [terminarTalles, setTerminarTalles] = useState<{ talle: string; cantidad: string }[]>([]);
  const [terminarSaving, setTerminarSaving] = useState(false);
  const [terminarError,  setTerminarError]  = useState('');

  const marcas  = catalogo.filter((c) => c.categoria === 'marca' && c.activo);
  const prendas = catalogo.filter((c) => c.categoria === 'prenda' && c.activo);
  const colores = catalogo.filter((c) => c.categoria === 'color' && c.activo);

  useEffect(() => {
    fetch('/api/sku-catalogo').then((r) => r.ok ? r.json() : []).then(setCatalogo).catch(() => {});
  }, []);

  useEffect(() => {
    if (!marcaAbrev || !prendaAbrev || !colorAbrev) { setSkuSugerido(null); return; }
    setLoadingSku(true);
    fetch('/api/sku/next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marca: marcaAbrev, prenda: prendaAbrev, color: colorAbrev }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setSkuSugerido(data?.sku ?? null))
      .catch(() => setSkuSugerido(null))
      .finally(() => setLoadingSku(false));
  }, [marcaAbrev, prendaAbrev, colorAbrev]);

  const cargar = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/produccion/cola');
    if (r.ok) setOrdenes(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    // SKU opcional: si elegiste marca+prenda+color se asigna ya; si no, se crea sin SKU
    // y se genera al mandar a costura.
    const marcaEntry = marcas.find((m) => m.abreviatura === marcaAbrev);
    setSaving(true);
    setError('');
    const r = await fetch('/api/produccion/cola', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: skuSugerido || undefined, descripcion, marca: marcaEntry?.nombre || undefined, cantidad, notas }),
    });
    const data = await r.json();
    if (!r.ok) {
      setError(data.error || 'Error al crear');
    } else {
      cargar();
      setMarcaAbrev(''); setPrendaAbrev(''); setColorAbrev('');
      setSkuSugerido(null); setDescripcion(''); setCantidad('1'); setNotas('');
      setShowForm(false);
    }
    setSaving(false);
  };

  const cambiarEstado = async (id: string, estado: string) => {
    const ordenT = ordenes.find((o) => o.id === id);
    // Para entrar a costura hace falta SKU; si la OP no lo tiene, pedir prenda+color.
    if (estado === 'COSTURA' && ordenT && !ordenT.sku) {
      setSkuModalOrden(ordenT);
      setSkuPrenda(''); setSkuColor(''); setSkuModalError('');
      return;
    }
    // Terminar costura: pide el conteo por talle (ingresa a stock).
    if (estado === 'TERMINADO_SIN_ESTAMPA' && ordenT?.estado === 'COSTURA') {
      abrirTerminar(ordenT);
      return;
    }
    const esRetroceso = (() => {
      const orden = ordenes.find((o) => o.id === id);
      if (!orden) return false;
      const siguientes = ESTADO_SIGUIENTE[orden.estado] || [];
      return !siguientes.includes(estado);
    })();

    if (esRetroceso && !cambioNotas.trim()) {
      setCambioId(id);
      return;
    }

    const r = await fetch(`/api/produccion/cola/${id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado, notas: cambioNotas || undefined }),
    });
    if (r.ok) {
      cargar();
      setCambioId(null);
      setCambioNotas('');
    } else {
      const d = await r.json();
      alert(d.error || 'Error al cambiar estado');
    }
  };

  // Genera/asigna el SKU (prenda+color) y avanza a costura, en un solo paso.
  const asignarSkuYAvanzar = async () => {
    if (!skuModalOrden || !skuPrenda || !skuColor) return;
    setSkuSaving(true);
    setSkuModalError('');
    const r = await fetch(`/api/produccion/cola/${skuModalOrden.id}/sku`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prenda: skuPrenda, color: skuColor }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setSkuModalError(d.error || 'Error al generar el SKU');
      setSkuSaving(false);
      return;
    }
    const r2 = await fetch(`/api/produccion/cola/${skuModalOrden.id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'COSTURA' }),
    });
    setSkuSaving(false);
    if (r2.ok) {
      setSkuModalOrden(null);
      setSkuPrenda(''); setSkuColor('');
      cargar();
    } else {
      const d = await r2.json().catch(() => ({}));
      setSkuModalError(d.error || 'Error al mandar a costura');
    }
  };

  // Revierte la ficha actual (devuelve el stock) para poder volver a cargarla.
  const revertirFicha = async (id: string) => {
    if (!confirm('Esto revierte la ficha actual y devuelve el stock consumido, para que la vuelvas a cargar. ¿Continuar?')) return;
    const r = await fetch(`/api/produccion/cola/${id}/corte/revertir`, { method: 'POST' });
    if (r.ok) cargar();
    else { const d = await r.json().catch(() => ({})); alert(d.error || 'Error al revertir'); }
  };

  // Terminar costura: prellena el conteo por talle desde la ficha (si está), editable.
  const abrirTerminar = async (orden: Orden) => {
    setTerminarOrden(orden);
    setTerminarError('');
    let talles: { talle: string; cantidad: string }[] = [];
    const r = await fetch(`/api/produccion/cola/${orden.id}/corte`);
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data.cortesPorTalle) && data.cortesPorTalle.length > 0) {
        talles = data.cortesPorTalle.map((c: { talle: string; cantidad: number }) => ({ talle: c.talle, cantidad: String(c.cantidad) }));
      }
    }
    setTerminarTalles(talles.length > 0 ? talles : [{ talle: '', cantidad: '' }]);
  };

  const setTalleRow = (i: number, field: 'talle' | 'cantidad', val: string) =>
    setTerminarTalles((prev) => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));
  const addTalleRow = () => setTerminarTalles((prev) => [...prev, { talle: '', cantidad: '' }]);
  const rmTalleRow  = (i: number) => setTerminarTalles((prev) => prev.filter((_, idx) => idx !== i));
  const totalTerminar = terminarTalles.reduce((s, t) => s + (parseInt(t.cantidad) || 0), 0);

  const confirmarTerminar = async () => {
    if (!terminarOrden) return;
    const talles = terminarTalles
      .filter((t) => t.talle.trim() && (parseInt(t.cantidad) || 0) > 0)
      .map((t) => ({ talle: t.talle.trim().toUpperCase(), cantidad: parseInt(t.cantidad) }));
    if (talles.length === 0) { setTerminarError('Cargá al menos un talle con cantidad'); return; }
    setTerminarSaving(true);
    setTerminarError('');
    const r = await fetch(`/api/produccion/cola/${terminarOrden.id}/terminar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ talles }),
    });
    setTerminarSaving(false);
    if (r.ok) { setTerminarOrden(null); cargar(); }
    else { const d = await r.json().catch(() => ({})); setTerminarError(d.error || 'Error al terminar'); }
  };

  const eliminar = async (id: string, sku: string | null) => {
    if (!confirm(`Eliminar la orden "${sku ?? 'sin SKU'}"?`)) return;
    const r = await fetch(`/api/produccion/cola/${id}`, { method: 'DELETE' });
    if (r.ok) setOrdenes((prev) => prev.filter((o) => o.id !== id));
  };

  const abrirEdicion = (orden: Orden) => {
    setEditando(orden);
    setEditDescripcion(orden.descripcion ?? '');
    setEditCantidad(String(orden.cantidad));
    setEditNotas(orden.notas ?? '');
    setEditError('');
  };

  const cerrarEdicion = () => { setEditando(null); setEditError(''); };

  const guardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editando) return;
    setEditSaving(true);
    setEditError('');
    const r = await fetch(`/api/produccion/cola/${editando.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descripcion: editDescripcion, cantidad: editCantidad, notas: editNotas }),
    });
    const data = await r.json();
    if (!r.ok) {
      setEditError(data.error || 'Error al guardar');
    } else {
      setOrdenes((prev) => prev.map((o) => o.id === data.id ? { ...o, ...data } : o));
      setEditando(null);
    }
    setEditSaving(false);
  };

  const filtradas = filtro === 'activos'
    ? ordenes.filter((o) => o.estado !== 'CERRADA')
    : ordenes.filter((o) => o.estado === filtro);

  const counts: Record<string, number> = { activos: ordenes.filter((o) => o.estado !== 'CERRADA').length };
  for (const e of ESTADOS) counts[e] = ordenes.filter((o) => o.estado === e).length;

  const inputClass = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {[['activos', 'Activos', counts.activos] as const, ...ESTADOS.map((e) => [e, ESTADO_LABEL[e], counts[e]] as const)].map(([k, label, n]) => (
          <button key={k} onClick={() => setFiltro(k)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${filtro === k ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'}`}>
            {label} <span className={`ml-1 ${filtro === k ? 'opacity-70' : 'text-stone-400'}`}>{n}</span>
          </button>
        ))}
        <button onClick={cargar} className="ml-auto px-3 py-2 text-xs border border-stone-200 rounded-xl text-stone-500 hover:border-stone-400 transition">
          Actualizar
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 text-xs font-bold uppercase tracking-widest text-stone-400">
          <span>SKU</span>
          <span>Descripcion</span>
          <span className="text-center">Cant.</span>
          <span>Estado</span>
          <span className="text-right">Dias</span>
          <span className="text-right">Costo</span>
          <span />
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-stone-400 text-sm">Cargando...</div>
        ) : filtradas.length === 0 ? (
          <div className="px-5 py-10 text-center text-stone-400 text-sm">Sin ordenes</div>
        ) : (
          filtradas.map((orden, i) => {
            const dias = diasEnEstado(orden.transiciones);
            const siguientes = ESTADO_SIGUIENTE[orden.estado] || [];
            return (
              <div key={orden.id}
                className={`px-5 py-4 grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 items-center ${i !== 0 ? 'border-t border-stone-100' : ''} ${orden.estado === 'CERRADA' ? 'opacity-60' : ''}`}>
                <Link href={`/produccion/${orden.id}`}
                  className={`font-mono font-bold text-sm px-2 py-1 rounded-lg transition ${orden.sku ? 'bg-stone-100 text-stone-700 hover:text-amber-600' : 'bg-amber-50 text-amber-600 hover:text-amber-700'}`}>
                  {orden.sku ?? 'S/SKU'}
                </Link>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-stone-800 font-medium truncate">{orden.descripcion || '--'}</p>
                    <span className="text-xs text-stone-400 shrink-0">{orden.marca}</span>
                    {!orden.sku && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">SKU pendiente</span>}
                    {!orden.fichaCorteCargada && orden.estado !== 'CERRADA' && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Ficha pendiente</span>}
                  </div>
                  <p className="text-xs text-stone-400">{fechaCorta(orden.createdAt)} · {orden.creadoPor}</p>
                </div>
                <span className="text-sm font-bold text-stone-700 text-center tabular-nums">{orden.cantidad}</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${ESTADO_COLOR[orden.estado] ?? 'bg-stone-100'}`}>
                  {ESTADO_LABEL[orden.estado] ?? orden.estado}
                </span>
                <span className={`text-xs tabular-nums text-right ${dias > 3 ? 'text-red-500 font-semibold' : 'text-stone-400'}`}>
                  {dias}d
                </span>
                <span className="text-xs tabular-nums text-right text-stone-500">
                  {Number(orden.costoTotal) > 0 ? `$${fmt(orden.costoTotal)}` : '--'}
                </span>
                <div className="flex gap-1.5 shrink-0">
                  {!orden.fichaCorteCargada && orden.estado !== 'CERRADA' && (
                    <Link href={`/produccion/${orden.id}/corte`}
                      className="text-xs px-2.5 py-1 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition">
                      Ficha
                    </Link>
                  )}
                  {orden.fichaCorteCargada && orden.estado !== 'CERRADA' && (
                    <button onClick={() => revertirFicha(orden.id)} title="Editar ficha (la revierte para recargarla)"
                      className="text-xs px-2.5 py-1 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 transition">
                      ✎ Ficha
                    </button>
                  )}
                  {siguientes.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => { if (e.target.value) cambiarEstado(orden.id, e.target.value); }}
                      className="text-xs px-2 py-1 rounded-lg border border-stone-200 text-stone-600 bg-white cursor-pointer"
                    >
                      <option value="">Avanzar</option>
                      {siguientes.map((s) => (
                        <option key={s} value={s}>{ESTADO_LABEL[s]}</option>
                      ))}
                    </select>
                  )}
                  <button onClick={() => abrirEdicion(orden)}
                    title="Editar"
                    className="text-xs px-2 py-1 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition">
                    ✎
                  </button>
                  <button onClick={() => eliminar(orden.id, orden.sku)}
                    className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition">
                    x
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Boton agregar */}
      {!showForm && (
        <button onClick={() => setShowForm(true)}
          className="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
          + Agregar a la cola
        </button>
      )}

      {/* Form crear */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-stone-800">Nueva orden de produccion</h3>
            <Link href="/produccion/catalogo-sku" className="text-xs text-stone-500 hover:text-stone-800 transition">
              Editar catalogo →
            </Link>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Marca</label>
                <select value={marcaAbrev} onChange={(e) => setMarcaAbrev(e.target.value)} className={inputClass}>
                  <option value="">--</option>
                  {marcas.map((m) => <option key={m.id} value={m.abreviatura}>{m.nombre} ({m.abreviatura})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Prenda</label>
                <select value={prendaAbrev} onChange={(e) => setPrendaAbrev(e.target.value)} className={inputClass}>
                  <option value="">--</option>
                  {prendas.map((p) => <option key={p.id} value={p.abreviatura}>{p.nombre} ({p.abreviatura})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Color</label>
                <select value={colorAbrev} onChange={(e) => setColorAbrev(e.target.value)} className={inputClass}>
                  <option value="">--</option>
                  {colores.map((c) => <option key={c.id} value={c.abreviatura}>{c.nombre} ({c.abreviatura})</option>)}
                </select>
              </div>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">SKU (opcional)</p>
                <p className="font-mono font-bold text-base text-stone-800">
                  {loadingSku ? '...' : skuSugerido ?? '— se asigna al mandar a costura —'}
                </p>
              </div>
              {skuSugerido && <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-1 rounded">próximo libre</span>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Cantidad</label>
                <NumInput value={parseFloat(cantidad) || 0} onChange={(n) => setCantidad(n ? String(n) : '')} min="1" className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Descripcion</label>
                <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Opcional" className={inputClass} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Notas internas</label>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones..." rows={2} className={`${inputClass} resize-none`} />
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
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

      {/* Mini-modal: asignar SKU al mandar a costura */}
      {skuModalOrden && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-4" onClick={() => setSkuModalOrden(null)}>
          <div className="bg-white rounded-2xl border border-stone-200 p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-stone-800 mb-1">Mandar a costura</h3>
            <p className="text-xs text-stone-500 mb-4">
              Generá el SKU para <span className="font-semibold">{skuModalOrden.descripcion || skuModalOrden.marca}</span> (marca: {skuModalOrden.marca}).
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Prenda</label>
                <select value={skuPrenda} onChange={(e) => setSkuPrenda(e.target.value)} className={inputClass}>
                  <option value="">--</option>
                  {prendas.map((p) => <option key={p.id} value={p.abreviatura}>{p.nombre} ({p.abreviatura})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Color</label>
                <select value={skuColor} onChange={(e) => setSkuColor(e.target.value)} className={inputClass}>
                  <option value="">--</option>
                  {colores.map((c) => <option key={c.id} value={c.abreviatura}>{c.nombre} ({c.abreviatura})</option>)}
                </select>
              </div>
            </div>
            {skuModalError && <p className="text-red-500 text-xs mb-2">{skuModalError}</p>}
            <div className="flex gap-2">
              <button onClick={asignarSkuYAvanzar} disabled={skuSaving || !skuPrenda || !skuColor}
                className="flex-1 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-semibold transition">
                {skuSaving ? 'Generando...' : 'Generar SKU y mandar a costura'}
              </button>
              <button onClick={() => setSkuModalOrden(null)}
                className="px-4 py-2 rounded-xl text-sm border border-stone-200 text-stone-600 transition">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal terminar costura: conteo por talle → stock de terminados */}
      {terminarOrden && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-4" onClick={() => setTerminarOrden(null)}>
          <div className="bg-white rounded-2xl border border-stone-200 p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-stone-800 mb-1">Terminar costura <span className="font-mono text-stone-500">{terminarOrden.sku}</span></h3>
            <p className="text-xs text-stone-500 mb-3">¿Cuántas salieron de cada talle? Ingresan al stock de terminados.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {terminarTalles.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={t.talle} onChange={(e) => setTalleRow(i, 'talle', e.target.value.toUpperCase())} placeholder="Talle"
                    className="w-24 px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400" />
                  <NumInput value={parseFloat(t.cantidad) || 0} onChange={(n) => setTalleRow(i, 'cantidad', n ? String(n) : '')} placeholder="Cant." min="0"
                    className="flex-1 px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400" />
                  <button type="button" onClick={() => rmTalleRow(i)} className="text-stone-400 hover:text-red-500 px-1 text-lg leading-none">×</button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2">
              <button type="button" onClick={addTalleRow} className="text-xs text-stone-500 hover:text-stone-800 transition">+ Agregar talle</button>
              <span className="text-xs text-stone-500">Total: <strong className="text-stone-800">{totalTerminar}</strong> u</span>
            </div>
            {terminarError && <p className="text-red-500 text-xs mt-2">{terminarError}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={confirmarTerminar} disabled={terminarSaving || totalTerminar === 0}
                className="flex-1 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-semibold transition">
                {terminarSaving ? 'Terminando...' : 'Terminar y mandar a stock'}
              </button>
              <button onClick={() => setTerminarOrden(null)}
                className="px-4 py-2 rounded-xl text-sm border border-stone-200 text-stone-600 transition">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cambio estado con notas (retroceso) */}
      {cambioId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-4" onClick={() => setCambioId(null)}>
          <div className="bg-white rounded-2xl border border-stone-200 p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-stone-800 mb-3">Motivo del cambio</h3>
            <textarea value={cambioNotas} onChange={(e) => setCambioNotas(e.target.value)}
              placeholder="Motivo obligatorio para retroceder..." rows={3}
              className={`${inputClass} resize-none mb-3`} />
            <div className="flex gap-2">
              <button onClick={() => { const orden = ordenes.find((o) => o.id === cambioId); if (orden) cambiarEstado(cambioId, orden.estado); }}
                disabled={!cambioNotas.trim()}
                className="flex-1 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-semibold transition">
                Confirmar
              </button>
              <button onClick={() => { setCambioId(null); setCambioNotas(''); }}
                className="px-4 py-2 rounded-xl text-sm border border-stone-200 text-stone-600 transition">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal edicion */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-4" onClick={cerrarEdicion}>
          <div className="bg-white rounded-2xl border border-stone-200 p-5 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-stone-800">Editar orden</h3>
                <p className="font-mono text-xs text-stone-500 mt-0.5">{editando.sku}</p>
              </div>
              <button type="button" onClick={cerrarEdicion} className="text-stone-400 hover:text-stone-700 text-lg leading-none">x</button>
            </div>
            <form onSubmit={guardarEdicion} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Cantidad</label>
                  <NumInput value={parseFloat(editCantidad) || 0} onChange={(n) => setEditCantidad(n ? String(n) : '')} min="1" className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Descripcion</label>
                  <input type="text" value={editDescripcion} onChange={(e) => setEditDescripcion(e.target.value)} placeholder="Opcional" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Notas internas</label>
                <textarea value={editNotas} onChange={(e) => setEditNotas(e.target.value)} rows={3} className={`${inputClass} resize-none`} />
              </div>
              {editError && <p className="text-red-500 text-xs">{editError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={editSaving}
                  className="flex-1 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition">
                  {editSaving ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button type="button" onClick={cerrarEdicion}
                  className="px-4 py-2.5 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
