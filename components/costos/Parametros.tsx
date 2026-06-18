'use client';

import { useState, useEffect, useCallback } from 'react';
import { NumInput } from '@/components/ui/NumInput';

interface GastoFijo { id: string; nombre: string; monto: number; categoria: string; activo: boolean; }
interface CostoCosturera { id: string; usuarioId: string; sueldoBruto: number; cargasSociales: number; horasMes: number; }
interface UsuarioSimple { id: string; nombre: string; }

const CATEGORIAS = ['alquiler', 'servicios', 'maquinaria', 'insumos', 'otro'];

function fmt$(n: number) { return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`; }

export function Parametros() {
  const [gastos,     setGastos]     = useState<GastoFijo[]>([]);
  const [costureras, setCostureras] = useState<CostoCosturera[]>([]);
  const [usuarios,   setUsuarios]   = useState<UsuarioSimple[]>([]);
  const [loading,    setLoading]    = useState(true);

  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoMonto,  setNuevoMonto]  = useState('');
  const [nuevaCat,    setNuevaCat]    = useState('otro');
  const [savingG,     setSavingG]     = useState(false);

  const [editGastoId, setEditGastoId] = useState<string | null>(null);
  const [editMonto,   setEditMonto]   = useState('');

  const [margenDesarrollo, setMargenDesarrollo] = useState('10');
  const [margenFallas,     setMargenFallas]     = useState('5');
  const [savingM,          setSavingM]          = useState(false);
  const [savedM,           setSavedM]           = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [rG, rC] = await Promise.all([
      fetch('/api/costos/gastos'),
      fetch('/api/costos/costureras'),
    ]);
    if (rG.ok) setGastos(await rG.json());
    if (rC.ok) { const d = await rC.json(); setCostureras(d.costureras); setUsuarios(d.usuarios); }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    fetch('/api/costos/config')
      .then((r) => r.json())
      .then((c) => {
        if (c && typeof c.margenDesarrollo === 'number') {
          setMargenDesarrollo(String(c.margenDesarrollo));
          setMargenFallas(String(c.margenFallas));
        }
      })
      .catch(() => {});
  }, []);

  const guardarMargenes = async () => {
    setSavingM(true);
    const r = await fetch('/api/costos/config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ margenDesarrollo: parseFloat(margenDesarrollo) || 0, margenFallas: parseFloat(margenFallas) || 0 }),
    });
    setSavingM(false);
    if (r.ok) { setSavedM(true); setTimeout(() => setSavedM(false), 2000); }
  };

  const agregarGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;
    setSavingG(true);
    const r = await fetch('/api/costos/gastos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nuevoNombre, monto: nuevoMonto, categoria: nuevaCat }),
    });
    if (r.ok) { const d = await r.json(); setGastos((prev) => [...prev, d]); setNuevoNombre(''); setNuevoMonto(''); setNuevaCat('otro'); }
    setSavingG(false);
  };

  const guardarMonto = async (id: string) => {
    const r = await fetch(`/api/costos/gastos/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monto: editMonto }),
    });
    if (r.ok) { const updated = await r.json(); setGastos((prev) => prev.map((g) => g.id === id ? updated : g)); setEditGastoId(null); }
  };

  const eliminarGasto = async (id: string) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    const r = await fetch(`/api/costos/gastos/${id}`, { method: 'DELETE' });
    if (r.ok) setGastos((prev) => prev.filter((g) => g.id !== id));
  };

  const guardarCosturera = async (usuarioId: string, data: Partial<CostoCosturera>) => {
    const existing = costureras.find((c) => c.usuarioId === usuarioId);
    const r = await fetch('/api/costos/costureras', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuarioId, ...(existing ?? {}), ...data }),
    });
    if (r.ok) {
      const updated = await r.json();
      setCostureras((prev) => {
        const idx = prev.findIndex((c) => c.usuarioId === usuarioId);
        return idx >= 0 ? prev.map((c) => c.usuarioId === usuarioId ? updated : c) : [...prev, updated];
      });
    }
  };

  const totalGastos   = gastos.filter((g) => g.activo).reduce((s, g) => s + g.monto, 0);
  const totalCosturas = costureras.reduce((s, c) => s + c.sueldoBruto + c.cargasSociales, 0);
  const totalHoras    = costureras.reduce((s, c) => s + c.horasMes, 0);
  const totalMensual  = totalGastos + totalCosturas;
  const valorHora     = totalHoras > 0 ? totalMensual / totalHoras : 0;
  const costoMinuto   = valorHora / 60;

  const inputCls = 'w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-violet-400';

  if (loading) return <div className="text-center py-16 text-stone-400 text-sm">Cargando...</div>;

  return (
    <div className="space-y-8 max-w-3xl">

      {/* Resumen calculado */}
      <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-violet-500 mb-4">Resumen calculado</p>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Gastos fijos', value: fmt$(totalGastos) },
            { label: 'Costo costureras', value: fmt$(totalCosturas) },
            { label: 'Valor hora taller', value: `${fmt$(Math.round(valorHora))}/h` },
            { label: 'Costo por minuto', value: `${fmt$(Math.round(costoMinuto))}/min` },
          ].map((k) => (
            <div key={k.label} className="text-center">
              <p className="text-xs text-violet-500 mb-1">{k.label}</p>
              <p className="text-lg font-bold text-violet-800">{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Márgenes */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <h3 className="text-sm font-bold text-stone-800 mb-1">Márgenes</h3>
        <p className="text-xs text-stone-400 mb-4">Se aplican a todos los escandallos.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-stone-400 mb-1 block">Margen de desarrollo %</label>
            <NumInput value={parseFloat(margenDesarrollo) || 0} onChange={(n) => setMargenDesarrollo(n ? String(n) : '')}
              placeholder="10" min="0" max="100" step="0.5" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-stone-400 mb-1 block">Margen de fallas %</label>
            <NumInput value={parseFloat(margenFallas) || 0} onChange={(n) => setMargenFallas(n ? String(n) : '')}
              placeholder="5" min="0" max="100" step="0.5" className={inputCls} />
          </div>
        </div>
        <button onClick={guardarMargenes} disabled={savingM}
          className={`mt-4 px-4 py-2 rounded-xl text-sm font-semibold transition ${savedM ? 'bg-emerald-600 text-white' : 'bg-stone-900 hover:bg-stone-800 text-white disabled:opacity-50'}`}>
          {savingM ? 'Guardando...' : savedM ? '✓ Guardado' : 'Guardar márgenes'}
        </button>
      </div>

      {/* Gastos fijos */}
      <div>
        <h3 className="text-sm font-bold text-stone-800 mb-4">Gastos fijos del taller</h3>
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden mb-3">
          {gastos.length === 0 && <p className="px-5 py-8 text-center text-stone-400 text-sm">Sin gastos cargados</p>}
          {gastos.map((g, i) => (
            <div key={g.id} className={`px-5 py-3.5 flex items-center gap-4 ${i !== 0 ? 'border-t border-stone-100' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800">{g.nombre}</p>
                <p className="text-xs text-stone-400 capitalize">{g.categoria}</p>
              </div>
              {editGastoId === g.id ? (
                <div className="flex items-center gap-2">
                  <NumInput value={parseFloat(editMonto) || 0} onChange={(n) => setEditMonto(n ? String(n) : '')}
                    className="w-32 px-2 py-1 border border-violet-300 rounded-lg text-sm focus:outline-none" autoFocus />
                  <button onClick={() => guardarMonto(g.id)} className="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg font-semibold">OK</button>
                  <button onClick={() => setEditGastoId(null)} className="text-xs text-stone-400 hover:text-stone-600">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-stone-900 tabular-nums">{fmt$(g.monto)}</span>
                  <button onClick={() => { setEditGastoId(g.id); setEditMonto(String(g.monto)); }}
                    className="text-xs px-2 py-1 border border-stone-200 rounded-lg text-stone-500 hover:border-stone-400 transition">Editar</button>
                  <button onClick={() => eliminarGasto(g.id)}
                    className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition">×</button>
                </div>
              )}
            </div>
          ))}
          {gastos.length > 0 && (
            <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex justify-between">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wide">Total mensual</span>
              <span className="text-sm font-bold text-stone-900">{fmt$(totalGastos)}</span>
            </div>
          )}
        </div>

        <form onSubmit={agregarGasto} className="flex gap-2">
          <input type="text" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)}
            placeholder="Nombre del gasto" className="flex-1 px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400" />
          <NumInput value={parseFloat(nuevoMonto) || 0} onChange={(n) => setNuevoMonto(n ? String(n) : '')}
            placeholder="Monto $" className="w-28 px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400" />
          <select value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)}
            className="px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400 capitalize">
            {CATEGORIAS.map((c) => <option key={c} className="capitalize">{c}</option>)}
          </select>
          <button type="submit" disabled={savingG || !nuevoNombre.trim()}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition">
            + Agregar
          </button>
        </form>
      </div>

      {/* Costos costureras */}
      <div>
        <h3 className="text-sm font-bold text-stone-800 mb-4">Costos por costurera</h3>
        {usuarios.length === 0 && (
          <p className="text-stone-400 text-sm">No hay costureras activas en el sistema.</p>
        )}
        <div className="space-y-3">
          {usuarios.map((u) => {
            const c = costureras.find((x) => x.usuarioId === u.id);
            return (
              <CostoCosturеraRow
                key={u.id}
                nombre={u.nombre}
                usuarioId={u.id}
                inicial={c}
                onGuardar={(data) => guardarCosturera(u.id, data)}
              />
            );
          })}
        </div>
        {costureras.length > 0 && (
          <div className="mt-4 bg-stone-50 rounded-xl px-4 py-3 flex justify-between border border-stone-200">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wide">Total mensual costureras</span>
            <span className="text-sm font-bold text-stone-900">{fmt$(totalCosturas)} · {totalHoras}h/mes</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CostoCosturеraRow({ nombre, usuarioId, inicial, onGuardar }: {
  nombre: string; usuarioId: string;
  inicial?: CostoCosturera;
  onGuardar: (data: Partial<CostoCosturera>) => Promise<void>;
}) {
  const [sueldo,  setSueldo]  = useState(String(inicial?.sueldoBruto    ?? ''));
  const [cargas,  setCargas]  = useState(String(inicial?.cargasSociales ?? ''));
  const [horas,   setHoras]   = useState(String(inicial?.horasMes       ?? '160'));
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  const guardar = async () => {
    setSaving(true);
    await onGuardar({ sueldoBruto: parseFloat(sueldo) || 0, cargasSociales: parseFloat(cargas) || 0, horasMes: parseFloat(horas) || 160 });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const total = (parseFloat(sueldo) || 0) + (parseFloat(cargas) || 0);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-stone-800">{nombre}</p>
        {total > 0 && <span className="text-xs font-bold text-stone-500">${total.toLocaleString('es-AR')}/mes</span>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-stone-400 mb-1 block">Sueldo bruto $</label>
          <NumInput value={parseFloat(sueldo) || 0} onChange={(n) => setSueldo(n ? String(n) : '')}
            placeholder="0" className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
        </div>
        <div>
          <label className="text-xs text-stone-400 mb-1 block">Cargas sociales $</label>
          <NumInput value={parseFloat(cargas) || 0} onChange={(n) => setCargas(n ? String(n) : '')}
            placeholder="0" className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
        </div>
        <div>
          <label className="text-xs text-stone-400 mb-1 block">Horas/mes</label>
          <NumInput value={parseFloat(horas) || 0} onChange={(n) => setHoras(n ? String(n) : '')}
            placeholder="160" className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
        </div>
      </div>
      <button onClick={guardar} disabled={saving}
        className={`mt-3 w-full py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition ${saved ? 'bg-emerald-600 text-white' : 'bg-stone-800 hover:bg-stone-700 text-white disabled:opacity-50'}`}>
        {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar'}
      </button>
    </div>
  );
}
