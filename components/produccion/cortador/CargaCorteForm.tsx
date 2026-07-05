'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TALLES_DEFAULT, TALLES_COMUNES } from '@/lib/validators/produccion';
import { toast } from '@/components/ui/Toaster';

interface Tizada { id: string; nombre: string; metros: string; unidades: string }
const inp = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';
const hoyISO = () => new Date().toLocaleDateString('en-CA');

// Form del cortador para cargar su corte de una OP: tizadas (nombre/metros/unidades),
// talles y precio. Sin rollos (los asigna la diseñadora). Guarda en estado 'cargado'.
export function CargaCorteForm({ ordenId, cantidadPlanificada }: { ordenId: string; cantidadPlanificada: number }) {
  const router = useRouter();
  const seq = useRef(2);
  const [tizadas, setTizadas] = useState<Tizada[]>([{ id: 't1', nombre: '', metros: '', unidades: '1' }]);
  const [talles, setTalles] = useState<Record<string, string>>({});
  const [tallesExtra, setTallesExtra] = useState<string[]>([]);
  const [costoCorte, setCostoCorte] = useState('');
  const [modoCosto, setModoCosto] = useState<'total' | 'unidad'>('total');
  const [fecha, setFecha] = useState(hoyISO());
  const [saving, setSaving] = useState(false);

  const totalU = Object.values(talles).reduce((s, v) => s + (parseInt(v) || 0), 0);
  const visibles = [...new Set([...TALLES_COMUNES, ...tallesExtra, ...Object.keys(talles).filter((t) => (parseInt(talles[t]) || 0) > 0)])]
    .sort((a, b) => (TALLES_DEFAULT as readonly string[]).indexOf(a) - (TALLES_DEFAULT as readonly string[]).indexOf(b));
  const agregables = [...TALLES_DEFAULT].filter((t) => !visibles.includes(t));

  const updTizada = (id: string, f: keyof Tizada, v: string) => setTizadas((p) => p.map((t) => t.id === id ? { ...t, [f]: v } : t));

  const guardar = async () => {
    const tizadasValidas = tizadas.filter((t) => (parseFloat(t.metros) || 0) > 0);
    if (tizadasValidas.length === 0) { toast.error('Cargá al menos una tizada con metros'); return; }
    const tallesArr = Object.entries(talles).map(([talle, v]) => ({ talle, cantidad: parseInt(v) || 0 })).filter((t) => t.cantidad > 0);
    if (tallesArr.length === 0) { toast.error('Cargá los talles'); return; }
    setSaving(true);
    const r = await fetch(`/api/cortador/carga/${ordenId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tizadas: tizadasValidas.map((t) => ({ nombre: t.nombre, metros: t.metros, unidades: t.unidades })), talles: tallesArr, costoCorte: parseFloat(costoCorte) || 0, modoCosto, fechaCorte: fecha || undefined }),
    });
    if (r.ok) { toast.success('Corte cargado — queda pendiente de que el taller asigne la tela'); router.push('/cortador'); router.refresh(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo guardar'); }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* Tizadas */}
      <Card padding="none" className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-stone-800">Tizadas</h3>
          <button type="button" onClick={() => setTizadas((p) => [...p, { id: `t${seq.current++}`, nombre: '', metros: '', unidades: '1' }])}
            className="text-xs px-3 py-1 border border-stone-200 rounded-lg text-stone-600 hover:border-stone-400 transition">+ Tizada</button>
        </div>
        <div className="space-y-3">
          {tizadas.map((t, i) => {
            const mu = (parseFloat(t.metros) || 0) / (parseInt(t.unidades) || 1);
            return (
              <div key={t.id} className="border border-stone-100 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-stone-400 shrink-0">Tizada {i + 1}</span>
                  <input type="text" value={t.nombre} onChange={(e) => updTizada(t.id, 'nombre', e.target.value)} placeholder="Nombre (Cuerpo, Puño…)" className={`${inp} flex-1`} />
                  {tizadas.length > 1 && <button type="button" onClick={() => setTizadas((p) => p.filter((x) => x.id !== t.id))} className="text-stone-300 hover:text-red-400 text-xl leading-none">×</button>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-stone-500 mb-1 block">Metros</label><NumInput value={parseFloat(t.metros) || 0} onChange={(n) => updTizada(t.id, 'metros', n ? String(n) : '')} min="0" step="0.01" className={`${inp} w-full`} /></div>
                  <div><label className="text-xs text-stone-500 mb-1 block">Unidades que rinde</label><NumInput value={parseFloat(t.unidades) || 0} onChange={(n) => updTizada(t.id, 'unidades', n ? String(n) : '')} min="1" className={`${inp} w-full`} /></div>
                </div>
                {mu > 0 && <p className="text-xs text-stone-500 mt-1.5">Rinde: <strong>{mu.toLocaleString('es-AR', { maximumFractionDigits: 2 })} m/u</strong></p>}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Talles */}
      <Card padding="none" className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-stone-800">Talles cortados</h3>
          <span className="text-xs text-stone-400">Total: <strong className="text-stone-700">{totalU}</strong> u{cantidadPlanificada ? ` · plan ${cantidadPlanificada}` : ''}</span>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          {visibles.map((t) => (
            <div key={t} className="w-16">
              <label className="text-xs font-semibold text-stone-500 mb-1 block text-center">{t}</label>
              <NumInput value={parseFloat(talles[t]) || 0} onChange={(n) => setTalles((p) => ({ ...p, [t]: n ? String(n) : '' }))} min="0" placeholder="0" className={`${inp} w-full text-center`} />
            </div>
          ))}
          {agregables.length > 0 && (
            <select value="" onChange={(e) => { if (e.target.value) setTallesExtra((p) => [...p, e.target.value]); }} className={`${inp} self-end`} title="Agregar talle">
              <option value="">+ talle</option>
              {agregables.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
      </Card>

      {/* Precio + fecha */}
      <Card padding="none" className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Precio del corte</label>
          <div className="flex gap-2">
            <NumInput value={parseFloat(costoCorte) || 0} onChange={(n) => setCostoCorte(n ? String(n) : '')} min="0" className={`${inp} flex-1`} />
            <div className="flex rounded-lg border border-stone-200 overflow-hidden shrink-0">
              {(['total', 'unidad'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setModoCosto(m)} className={`px-3 text-xs font-semibold ${modoCosto === m ? 'bg-stone-900 text-white' : 'bg-white text-stone-500'}`}>{m}</button>
              ))}
            </div>
          </div>
          {modoCosto === 'unidad' && (parseFloat(costoCorte) || 0) > 0 && totalU > 0 && (
            <p className="text-xs text-stone-500 mt-1">= ${((parseFloat(costoCorte) || 0) * totalU).toLocaleString('es-AR')} total</p>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Fecha del corte</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${inp} w-full`} />
        </div>
      </Card>

      <div className="flex gap-2">
        <Button variant="primary" onClick={guardar} isLoading={saving}>Guardar corte</Button>
        <Button variant="secondary" onClick={() => router.push('/cortador')}>Cancelar</Button>
      </div>
    </div>
  );
}
