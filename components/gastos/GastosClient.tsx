'use client';

import { useState } from 'react';

interface Gasto {
  id:        string;
  categoria: string;
  tipo:      string;
  marca:     string | null;
  sku:       string | null;
  ordenId:   string | null;
  minutos:   number | null;
  monto:     number;
  concepto:  string | null;
  fecha:     string;
  creadoPor: string;
  tiempoId:  string | null;
  createdAt: string;
}

interface OrdenActiva {
  id:  string;
  sku: string;
  descripcion: string | null;
  marca: string;
}

interface Props {
  gastosDesarrollo: Gasto[];
  gastosProduccion: Gasto[];
  ordenes:          OrdenActiva[];
  costoMinuto:      number;
}

// Para gastos auto-derivados de un tiempo (muestras), el monto guardado puede
// estar desactualizado o ser 0 si los costos no estaban configurados al momento
// del registro. Calculamos al vuelo con la tarifa vigente.
function montoEfectivo(g: Gasto, costoMinuto: number): number {
  if (g.tiempoId && g.minutos && g.minutos > 0) {
    return Math.round(g.minutos * costoMinuto);
  }
  return g.monto;
}

type Tab = 'desarrollo' | 'produccion';
type Tipo = 'tela' | 'insumos' | 'periodo';
const TIPOS: Tipo[] = ['tela', 'insumos', 'periodo'];
const MARCAS = ['Zattia', 'Stunned'] as const;

function fmt$(n: number) {
  return `$${Math.round(n).toLocaleString('es-AR')}`;
}

function TotalCards({ gastos, costoMinuto }: { gastos: Gasto[]; costoMinuto: number }) {
  const porTipo = TIPOS.map((t) => ({
    tipo:  t,
    total: gastos.filter((g) => g.tipo === t).reduce((s, g) => s + montoEfectivo(g, costoMinuto), 0),
  }));
  const total = gastos.reduce((s, g) => s + montoEfectivo(g, costoMinuto), 0);

  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {porTipo.map(({ tipo, total: t }) => (
        <div key={tipo} className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs text-stone-400 capitalize mb-1">{tipo}</p>
          <p className="text-lg font-bold text-stone-900">{fmt$(t)}</p>
        </div>
      ))}
      <div className="bg-stone-900 rounded-xl p-4">
        <p className="text-xs text-stone-400 mb-1">Total</p>
        <p className="text-lg font-bold text-white">{fmt$(total)}</p>
      </div>
    </div>
  );
}

function GastoRow({ gasto, costoMinuto, onDelete }: { gasto: Gasto; costoMinuto: number; onDelete: (id: string) => void }) {
  const monto = montoEfectivo(gasto, costoMinuto);
  const [confirming, setConfirming] = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/gastos/${gasto.id}`, { method: 'DELETE' });
    onDelete(gasto.id);
  };

  return (
    <div className="px-4 py-3 flex items-center gap-3 border-t border-stone-100 first:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wide text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
            {gasto.tipo}
          </span>
          {gasto.marca && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${gasto.marca === 'Zattia' ? 'bg-violet-100 text-violet-700' : 'bg-pink-100 text-pink-700'}`}>
              {gasto.marca}
            </span>
          )}
          {gasto.sku && <span className="text-xs font-mono text-stone-600">{gasto.sku}</span>}
          {gasto.tiempoId && <span className="text-xs text-stone-400 italic">auto</span>}
        </div>
        {gasto.concepto && <p className="text-sm text-stone-700 mt-0.5">{gasto.concepto}</p>}
        <p className="text-xs text-stone-400 mt-0.5">{gasto.fecha} · {gasto.creadoPor}{gasto.minutos ? ` · ${gasto.minutos}min` : ''}</p>
      </div>
      <span className="font-bold text-stone-900 tabular-nums shrink-0">{fmt$(monto)}</span>
      {!confirming ? (
        <button onClick={() => setConfirming(true)} className="text-stone-300 hover:text-red-400 text-sm transition shrink-0">×</button>
      ) : (
        <div className="flex gap-1 shrink-0">
          <button onClick={handleDelete} disabled={deleting} className="text-xs bg-red-600 text-white px-2 py-1 rounded font-semibold disabled:opacity-50">
            {deleting ? '...' : 'Sí'}
          </button>
          <button onClick={() => setConfirming(false)} className="text-xs border border-stone-200 px-2 py-1 rounded text-stone-500">No</button>
        </div>
      )}
    </div>
  );
}

function FormDesarrollo({ onCreado }: { onCreado: (g: Gasto) => void }) {
  const [tipo,     setTipo]     = useState<Tipo>('tela');
  const [marca,    setMarca]    = useState<'Zattia' | 'Stunned'>('Zattia');
  const [sku,      setSku]      = useState('');
  const [monto,    setMonto]    = useState('');
  const [concepto, setConcepto] = useState('');
  const [saving,   setSaving]   = useState(false);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monto) return;
    setSaving(true);
    const res = await fetch('/api/gastos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoria: 'desarrollo',
        tipo, marca, sku: sku.trim() || null,
        monto: parseFloat(monto),
        concepto: concepto.trim() || null,
        fecha: new Date().toISOString().split('T')[0],
      }),
    });
    if (res.ok) {
      const g = await res.json();
      onCreado(g);
      setMonto(''); setSku(''); setConcepto('');
    }
    setSaving(false);
  };

  const inputCls = 'w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';

  return (
    <form onSubmit={guardar} className="bg-stone-50 rounded-2xl border border-stone-200 p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Agregar gasto de desarrollo</p>

      <div className="flex gap-2">
        {TIPOS.map((t) => (
          <button key={t} type="button" onClick={() => setTipo(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition capitalize ${tipo === t ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {MARCAS.map((m) => (
          <button key={m} type="button" onClick={() => setMarca(m)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition ${
              marca === m
                ? m === 'Zattia' ? 'bg-violet-600 border-violet-600 text-white' : 'bg-pink-600 border-pink-600 text-white'
                : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'
            }`}>
            {m}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())}
          placeholder="SKU (opcional)" className={inputCls} />
        <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)}
          placeholder="Monto $" required className={inputCls} />
      </div>
      <input type="text" value={concepto} onChange={(e) => setConcepto(e.target.value)}
        placeholder="Concepto (opcional)" className={inputCls} />

      <button type="submit" disabled={saving || !monto}
        className="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition">
        {saving ? 'Guardando...' : 'Agregar gasto'}
      </button>
    </form>
  );
}

function FormProduccion({ ordenes, onCreado }: { ordenes: OrdenActiva[]; onCreado: (g: Gasto) => void }) {
  const [tipo,     setTipo]     = useState<Tipo>('tela');
  const [ordenId,  setOrdenId]  = useState('');
  const [monto,    setMonto]    = useState('');
  const [concepto, setConcepto] = useState('');
  const [saving,   setSaving]   = useState(false);

  const ordenSel = ordenes.find((o) => o.id === ordenId);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monto) return;
    setSaving(true);
    const res = await fetch('/api/gastos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoria: 'produccion',
        tipo,
        ordenId:  ordenId  || null,
        sku:      ordenSel?.sku || null,
        marca:    ordenSel?.marca || null,
        monto:    parseFloat(monto),
        concepto: concepto.trim() || null,
        fecha:    new Date().toISOString().split('T')[0],
      }),
    });
    if (res.ok) {
      const g = await res.json();
      onCreado(g);
      setMonto(''); setConcepto(''); setOrdenId('');
    }
    setSaving(false);
  };

  const inputCls = 'w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';

  return (
    <form onSubmit={guardar} className="bg-stone-50 rounded-2xl border border-stone-200 p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Agregar gasto de producción</p>

      <div className="flex gap-2">
        {TIPOS.map((t) => (
          <button key={t} type="button" onClick={() => setTipo(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition capitalize ${tipo === t ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'}`}>
            {t}
          </button>
        ))}
      </div>

      <select value={ordenId} onChange={(e) => setOrdenId(e.target.value)} className={inputCls}>
        <option value="">— Sin orden específica —</option>
        {ordenes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.sku} · {o.marca}{o.descripcion ? ` — ${o.descripcion}` : ''}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-2">
        <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)}
          placeholder="Monto $" required className={inputCls} />
        <input type="text" value={concepto} onChange={(e) => setConcepto(e.target.value)}
          placeholder="Concepto" className={inputCls} />
      </div>

      <button type="submit" disabled={saving || !monto}
        className="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition">
        {saving ? 'Guardando...' : 'Agregar gasto'}
      </button>
    </form>
  );
}

export function GastosClient({ gastosDesarrollo: gd0, gastosProduccion: gp0, ordenes, costoMinuto }: Props) {
  const [tab,              setTab]              = useState<Tab>('desarrollo');
  const [gastosDesarrollo, setGastosDesarrollo] = useState<Gasto[]>(gd0);
  const [gastosProduccion, setGastosProduccion] = useState<Gasto[]>(gp0);
  const [filtroMarca,      setFiltroMarca]      = useState<string>('todas');

  const gastosD = filtroMarca === 'todas'
    ? gastosDesarrollo
    : gastosDesarrollo.filter((g) => g.marca === filtroMarca);

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-7 border-b border-stone-200">
        {(['desarrollo', 'produccion'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition capitalize ${
              tab === t ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400 hover:text-stone-700'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'desarrollo' && (
        <div className="space-y-6">
          {/* Filtro marca */}
          <div className="flex gap-2">
            {['todas', ...MARCAS].map((m) => (
              <button key={m} onClick={() => setFiltroMarca(m)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition capitalize ${
                  filtroMarca === m ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'
                }`}>
                {m}
              </button>
            ))}
          </div>

          <TotalCards gastos={gastosD} costoMinuto={costoMinuto} />

          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            {gastosD.length === 0 && (
              <p className="px-4 py-10 text-center text-stone-400 text-sm">Sin gastos de desarrollo</p>
            )}
            {gastosD.map((g) => (
              <GastoRow key={g.id} gasto={g} costoMinuto={costoMinuto}
                onDelete={(id) => setGastosDesarrollo((prev) => prev.filter((x) => x.id !== id))} />
            ))}
          </div>

          <FormDesarrollo onCreado={(g) => setGastosDesarrollo((prev) => [g, ...prev])} />
        </div>
      )}

      {tab === 'produccion' && (
        <div className="space-y-6">
          <TotalCards gastos={gastosProduccion} costoMinuto={costoMinuto} />

          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            {gastosProduccion.length === 0 && (
              <p className="px-4 py-10 text-center text-stone-400 text-sm">Sin gastos de producción</p>
            )}
            {gastosProduccion.map((g) => (
              <GastoRow key={g.id} gasto={g} costoMinuto={costoMinuto}
                onDelete={(id) => setGastosProduccion((prev) => prev.filter((x) => x.id !== id))} />
            ))}
          </div>

          <FormProduccion ordenes={ordenes}
            onCreado={(g) => setGastosProduccion((prev) => [g, ...prev])} />
        </div>
      )}
    </div>
  );
}
