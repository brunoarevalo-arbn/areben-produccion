'use client';

import { useState, useEffect, useCallback } from 'react';
import { NumInput } from '@/components/ui/NumInput';

interface RolloOpt {
  id: string;
  codigo: string;
  pesoActual: string;
  estado: string;
  insumo: { nombre: string; rinde: string | null } | null;
  color: { nombre: string } | null;
  colorProveedor: string | null;
}
interface ProyectoOpt { id: string; nombre: string; }
interface Muestra {
  id: string;
  cantidad: string;
  motivo: string | null;
  fecha: string;
  rollo: { codigo: string; colorProveedor: string | null; insumo: { nombre: string; rinde: string | null } | null; color: { nombre: string } | null } | null;
  proyecto: { id: string; nombre: string } | null;
}

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const fmt = (n: string | number) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const colorRollo = (r: { color: { nombre: string } | null; colorProveedor: string | null }) =>
  r.color?.nombre || r.colorProveedor || 'sin color';
const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });

// El stock está en kg; con el rinde (m/kg) se muestra en metros.
const restanteTxt = (r: RolloOpt) => {
  const rinde = Number(r.insumo?.rinde);
  return rinde > 0 ? `${fmt(Number(r.pesoActual) * rinde)} m` : `${fmt(r.pesoActual)} kg`;
};
const metrosMuestra = (m: Muestra) => {
  const rinde = Number(m.rollo?.insumo?.rinde);
  const kg = Math.abs(Number(m.cantidad));
  return rinde > 0 ? `${fmt(kg * rinde)} m` : `${fmt(kg)} kg`;
};

export function MuestrasClient() {
  const [rollos, setRollos]       = useState<RolloOpt[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoOpt[]>([]);
  const [muestras, setMuestras]   = useState<Muestra[]>([]);

  const [rolloId, setRolloId]         = useState('');
  const [cantidad, setCantidad]       = useState('');
  const [proyectoId, setProyectoId]   = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  const cargar = useCallback(() => {
    fetch('/api/insumos/rollos').then((r) => r.ok ? r.json() : []).then((rs) =>
      setRollos((rs as RolloOpt[]).filter((r) => r.estado !== 'AGOTADO' && r.estado !== 'DESCARTADO' && Number(r.pesoActual) > 0)));
    fetch('/api/proyectos').then((r) => r.ok ? r.json() : []).then((ps) =>
      setProyectos((ps as ProyectoOpt[]).map((p) => ({ id: p.id, nombre: p.nombre }))));
    fetch('/api/produccion/muestras').then((r) => r.ok ? r.json() : []).then(setMuestras);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const rolloSel = rollos.find((r) => r.id === rolloId);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rolloId || !cantidad) return;
    setSaving(true);
    setError('');
    const r = await fetch('/api/produccion/muestras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rolloId, cantidad: parseFloat(cantidad), proyectoId: proyectoId || undefined, descripcion: descripcion || undefined }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError(d.error || 'Error al registrar la muestra');
      setSaving(false);
      return;
    }
    setRolloId(''); setCantidad(''); setProyectoId(''); setDescripcion('');
    setSaving(false);
    cargar();
  };

  return (
    <div className="space-y-6">
      {/* Form */}
      <form onSubmit={guardar} className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
        <h3 className="text-sm font-bold text-stone-800">Registrar muestra</h3>

        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Rollo del que se retira</label>
          <select value={rolloId} onChange={(e) => setRolloId(e.target.value)} className={inp}>
            <option value="">— Elegí un rollo —</option>
            {rollos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.insumo?.nombre ?? '?'} · {colorRollo(r)} · {r.codigo} (quedan {restanteTxt(r)})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Cantidad a retirar <span className="text-stone-400 font-normal">(metros)</span></label>
            <NumInput value={parseFloat(cantidad) || 0} onChange={(n) => setCantidad(n ? String(n) : '')} min="0" step="0.01"
              placeholder={rolloSel ? `en metros — quedan ${restanteTxt(rolloSel)}` : 'en metros'} className={inp} />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Proyecto de diseño <span className="text-stone-400 font-normal">(opcional)</span></label>
            <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className={inp}>
              <option value="">— Sin proyecto —</option>
              {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Nota <span className="text-stone-400 font-normal">(opcional)</span></label>
          <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej. muestra remera v1" className={inp} />
        </div>

        {error && <p className="text-red-500 text-xs">{error}</p>}
        <button type="submit" disabled={saving || !rolloId || !cantidad}
          className="bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
          {saving ? 'Registrando...' : 'Registrar muestra'}
        </button>
      </form>

      {/* Lista (sin costo) */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 grid grid-cols-[auto_1fr_auto_1fr_auto] gap-4 text-xs font-bold uppercase tracking-widest text-stone-400">
          <span>Fecha</span>
          <span>Insumo / color</span>
          <span className="text-right">Metros</span>
          <span>Proyecto</span>
          <span>Rollo</span>
        </div>
        {muestras.length === 0 ? (
          <div className="px-5 py-10 text-center text-stone-400 text-sm">Sin muestras registradas todavía.</div>
        ) : (
          muestras.map((m, i) => (
            <div key={m.id} className={`px-5 py-3 grid grid-cols-[auto_1fr_auto_1fr_auto] gap-4 items-center ${i > 0 ? 'border-t border-stone-100' : ''}`}>
              <span className="text-xs text-stone-500">{fechaCorta(m.fecha)}</span>
              <span className="text-sm text-stone-800 truncate">
                {m.rollo?.insumo?.nombre ?? '—'}
                {m.rollo && <span className="text-stone-400"> · {colorRollo(m.rollo)}</span>}
              </span>
              <span className="text-sm tabular-nums text-right text-stone-700">{metrosMuestra(m)}</span>
              <span className="text-sm text-stone-600 truncate">{m.proyecto?.nombre ?? <span className="text-stone-300">—</span>}</span>
              <span className="font-mono text-xs text-stone-500">{m.rollo?.codigo ?? '—'}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
