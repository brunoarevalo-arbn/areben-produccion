'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toaster';

interface Muestra { id: string; descripcion: string; consumo: number; unidad: string; valor: number; estado: string; fecha: string }
const inp = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';
const hoyISO = () => new Date().toLocaleDateString('en-CA');
const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

// Muestras del cortador: cargar (consumo + valor) y ver las suyas. Cobrables cuando el
// taller las valida.
export function MuestrasCortador({ inicial }: { inicial: Muestra[] }) {
  const router = useRouter();
  const [muestras, setMuestras] = useState(inicial);
  const [showForm, setShowForm] = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [consumo, setConsumo] = useState('');
  const [unidad, setUnidad] = useState<'m' | 'kg'>('m');
  const [valor, setValor] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    if (!descripcion.trim()) { toast.error('Poné una descripción'); return; }
    setSaving(true);
    const r = await fetch('/api/cortador/muestra', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descripcion: descripcion.trim(), consumo: parseFloat(consumo) || 0, unidad, valor: parseFloat(valor) || 0, fecha: fecha || undefined }),
    });
    if (r.ok) { const m = await r.json(); setMuestras((p) => [{ ...m, consumo: Number(m.consumo), valor: Number(m.valor) }, ...p]); setShowForm(false); setDescripcion(''); setConsumo(''); setValor(''); toast.success('Muestra cargada'); router.refresh(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo guardar'); }
    setSaving(false);
  };

  const borrar = async (id: string) => {
    const r = await fetch(`/api/cortador/muestra/${id}`, { method: 'DELETE' });
    if (r.ok) { setMuestras((p) => p.filter((m) => m.id !== id)); router.refresh(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo borrar'); }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-stone-800">Muestras</h2>
        {!showForm && <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>+ Cargar muestra</Button>}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-3 space-y-3">
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1 block">Descripción</label>
            <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Muestra remera boxy" className={`${inp} w-full`} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1 block">Consumo tizada</label>
              <NumInput value={parseFloat(consumo) || 0} onChange={(n) => setConsumo(n ? String(n) : '')} min="0" step="0.01" className={`${inp} w-full`} />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1 block">Unidad</label>
              <select value={unidad} onChange={(e) => setUnidad(e.target.value as 'm' | 'kg')} className={`${inp} w-full`}><option value="m">m</option><option value="kg">kg</option></select>
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1 block">Valor del corte</label>
              <NumInput value={parseFloat(valor) || 0} onChange={(n) => setValor(n ? String(n) : '')} min="0" className={`${inp} w-full`} />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1 block">Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${inp} w-full`} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={guardar} isLoading={saving}>Guardar muestra</Button>
            <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {muestras.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-6 text-center text-sm text-stone-400">Sin muestras cargadas.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
          {muestras.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              <div className="flex-1 min-w-0">
                <p className="text-stone-800 truncate">{m.descripcion}</p>
                <p className="text-xs text-stone-400">{Number(m.consumo)} {m.unidad} · {new Date(m.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' })}</p>
              </div>
              {m.estado === 'validado'
                ? <span className="text-xs font-semibold text-emerald-600 shrink-0">validada</span>
                : <span className="text-xs text-amber-600 shrink-0">pendiente</span>}
              <span className="font-semibold text-stone-700 tabular-nums shrink-0 w-20 text-right">{fmt$(Number(m.valor))}</span>
              {m.estado === 'pendiente' && <button onClick={() => borrar(m.id)} aria-label="Borrar" className="text-stone-300 hover:text-red-500 px-1 leading-none text-lg shrink-0">×</button>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
