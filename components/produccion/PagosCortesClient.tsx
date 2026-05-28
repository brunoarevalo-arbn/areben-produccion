'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface OrdenCorte {
  id: string;
  sku: string;
  cantidad: number;
  cortador: string | null;
  costoCorte: string;
  pagoCorteId: string | null;
  createdAt: string;
  estado: string;
  pagoCorte: { id: string; fecha: string; beneficiario: string; montoTotal: string } | null;
  transiciones: { fecha: string }[];
}

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const fmt = (n: string | number) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function PagosCortesClient() {
  const [ordenes, setOrdenes]   = useState<OrdenCorte[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filtro, setFiltro]     = useState<'pendiente' | 'pagado' | 'todos'>('pendiente');
  const [filtroCortador, setFiltroCortador] = useState('');
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());

  // Form de pago
  const [showForm, setShowForm] = useState(false);
  const [fecha, setFecha]       = useState(new Date().toISOString().slice(0, 10));
  const [beneficiario, setBeneficiario] = useState('');
  const [notas, setNotas]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtro !== 'todos') params.set('pago', filtro);
    if (filtroCortador) params.set('cortador', filtroCortador);
    const r = await fetch(`/api/produccion/pagos-cortes?${params}`);
    if (r.ok) setOrdenes(await r.json());
    setLoading(false);
  }, [filtro, filtroCortador]);

  useEffect(() => { cargar(); }, [cargar]);

  const cortadores = [...new Set(ordenes.map((o) => o.cortador).filter(Boolean) as string[])].sort();

  const toggleSel = (id: string) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const pendientes = ordenes.filter((o) => !o.pagoCorteId);
    if (seleccion.size === pendientes.length) {
      setSeleccion(new Set());
    } else {
      setSeleccion(new Set(pendientes.map((o) => o.id)));
    }
  };

  const seleccionadas = ordenes.filter((o) => seleccion.has(o.id));
  const totalSeleccionado = seleccionadas.reduce((s, o) => s + Number(o.costoCorte), 0);

  // Sugerir beneficiario del cortador de las seleccionadas si todas tienen el mismo
  const cortadoresUnicos = [...new Set(seleccionadas.map((o) => o.cortador).filter(Boolean))];

  const abrirPago = () => {
    if (seleccion.size === 0) return;
    if (cortadoresUnicos.length === 1) setBeneficiario(cortadoresUnicos[0]!);
    setShowForm(true);
    setError('');
  };

  const registrarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!beneficiario.trim()) { setError('Beneficiario obligatorio'); return; }
    if (!fecha) { setError('Fecha obligatoria'); return; }

    setSaving(true);
    setError('');
    const r = await fetch('/api/produccion/pagos-cortes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fecha,
        beneficiario: beneficiario.trim(),
        ordenIds: [...seleccion],
        notas: notas || undefined,
      }),
    });

    if (r.ok) {
      setShowForm(false);
      setSeleccion(new Set());
      setBeneficiario('');
      setNotas('');
      cargar();
    } else {
      const d = await r.json();
      setError(d.error || 'Error al registrar pago');
    }
    setSaving(false);
  };

  const totalPendiente = ordenes.filter((o) => !o.pagoCorteId).reduce((s, o) => s + Number(o.costoCorte), 0);

  return (
    <div className="space-y-5">
      {/* Stats por cortador */}
      {filtro === 'pendiente' && cortadores.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Pendiente por cortador</p>
          <div className="flex flex-wrap gap-3">
            {cortadores.map((c) => {
              const total = ordenes.filter((o) => o.cortador === c && !o.pagoCorteId).reduce((s, o) => s + Number(o.costoCorte), 0);
              const count = ordenes.filter((o) => o.cortador === c && !o.pagoCorteId).length;
              return (
                <div key={c} className="bg-stone-50 rounded-xl px-3 py-2 text-sm border border-stone-100">
                  <p className="text-xs text-stone-500">{c}</p>
                  <p className="text-stone-900 font-bold tabular-nums">${fmt(total)}</p>
                  <p className="text-xs text-stone-400">{count} corte(s)</p>
                </div>
              );
            })}
            <div className="bg-stone-900 text-white rounded-xl px-3 py-2 text-sm ml-auto">
              <p className="text-xs opacity-70">Total pendiente</p>
              <p className="font-bold tabular-nums text-lg">${fmt(totalPendiente)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        {(['pendiente', 'pagado', 'todos'] as const).map((f) => (
          <button key={f} onClick={() => { setFiltro(f); setSeleccion(new Set()); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${filtro === f ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <select value={filtroCortador} onChange={(e) => setFiltroCortador(e.target.value)}
          className="px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400">
          <option value="">Todos los cortadores</option>
          {cortadores.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {seleccion.size > 0 && (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-stone-600">
              {seleccion.size} seleccionadas · <strong>${fmt(totalSeleccionado)}</strong>
            </span>
            <button onClick={abrirPago}
              className="bg-stone-900 hover:bg-stone-800 text-white px-4 py-2 rounded-xl text-sm font-semibold transition">
              Registrar pago
            </button>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 grid grid-cols-[auto_auto_1fr_1fr_auto_auto_auto_auto] gap-4 text-xs font-bold uppercase tracking-widest text-stone-400 items-center">
          <input type="checkbox"
            checked={filtro === 'pendiente' && seleccion.size > 0 && seleccion.size === ordenes.filter((o) => !o.pagoCorteId).length}
            onChange={toggleAll}
            disabled={filtro !== 'pendiente'}
            className="rounded border-stone-300" />
          <span>SKU</span>
          <span>Cortador</span>
          <span>Pago</span>
          <span className="text-right">Unid.</span>
          <span className="text-right">Costo corte</span>
          <span>Fecha</span>
          <span />
        </div>

        {loading ? (
          <p className="text-sm text-stone-400 text-center py-10">Cargando...</p>
        ) : ordenes.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-10">Sin cortes</p>
        ) : (
          ordenes.map((o, i) => {
            const fechaCorte = o.transiciones[0]?.fecha;
            const pagado = !!o.pagoCorteId;
            return (
              <div key={o.id}
                className={`px-5 py-3 grid grid-cols-[auto_auto_1fr_1fr_auto_auto_auto_auto] gap-4 items-center text-sm ${i > 0 ? 'border-t border-stone-100' : ''} ${pagado ? 'opacity-60' : ''}`}>
                <input type="checkbox"
                  checked={seleccion.has(o.id)}
                  onChange={() => toggleSel(o.id)}
                  disabled={pagado}
                  className="rounded border-stone-300" />
                <Link href={`/produccion/${o.id}`}
                  className="font-mono font-bold text-xs bg-stone-100 px-2 py-1 rounded-lg text-stone-700 hover:text-amber-600 transition">
                  {o.sku}
                </Link>
                <span className="text-stone-700 truncate">{o.cortador || '--'}</span>
                <span className="text-xs">
                  {pagado ? (
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                      Pagado {o.pagoCorte && fechaCorta(o.pagoCorte.fecha)}
                    </span>
                  ) : (
                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Pendiente</span>
                  )}
                </span>
                <span className="text-stone-600 tabular-nums text-right">{o.cantidad}</span>
                <span className="text-stone-900 font-bold tabular-nums text-right">${fmt(o.costoCorte)}</span>
                <span className="text-stone-400 text-xs">{fechaCorte ? fechaCorta(fechaCorte) : '--'}</span>
                <Link href={`/produccion/${o.id}`} className="text-xs text-stone-500 hover:text-stone-800">Ver</Link>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de pago */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl border border-stone-200 p-6 w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-stone-800 mb-1">Registrar pago de cortes</h3>
            <p className="text-xs text-stone-500 mb-4">
              {seleccion.size} cortes · Total <strong>${fmt(totalSeleccionado)}</strong>
            </p>
            <form onSubmit={registrarPago} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Fecha *</label>
                  <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className={inp} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Beneficiario *</label>
                  <input type="text" value={beneficiario} onChange={(e) => setBeneficiario(e.target.value)} required
                    placeholder="A quien se le paga" className={inp} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Notas</label>
                <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2}
                  placeholder="Comprobante, referencia, etc." className={`${inp} resize-none`} />
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition">
                  {saving ? 'Registrando...' : `Registrar pago de $${fmt(totalSeleccionado)}`}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
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
