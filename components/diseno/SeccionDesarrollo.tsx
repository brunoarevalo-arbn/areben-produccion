'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProyectoDiseno } from '@/types/diseno';
import { calcularPrecioVenta, MARGEN_DEFAULT } from '@/lib/utils/calculos';
import { TimelinePasos } from './TimelinePasos';

const TELAS     = ['Algodón', 'Poliéster', 'Lino', 'Seda', 'Denim', 'Lycra', 'Modal', 'Otro'];
const MOLDERIAS = ['Base recta', 'Base entallada', 'Base evasé', 'Moldería propia', 'Otro'];

export function SeccionDesarrollo({ proyecto }: { proyecto: ProyectoDiseno }) {
  const router  = useRouter();
  const [form,   setForm]   = useState({
    molderia:       proyecto.molderia       ?? '',
    tela:           proyecto.tela           ?? '',
    costo:          proyecto.costo          ?? 0,
    precioEstimado: proyecto.precioEstimado ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const precioVenta = calcularPrecioVenta(form.costo);

  const guardar = async () => {
    setSaving(true);
    await fetch(`/api/proyectos/${proyecto.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, precioEstimado: precioVenta }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Ficha técnica */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400">Ficha técnica & Costos</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5">Moldería</label>
            <select value={form.molderia} onChange={(e) => setForm((p) => ({ ...p, molderia: e.target.value }))} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:border-violet-400">
              <option value="">— Seleccionar —</option>
              {MOLDERIAS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5">Tela</label>
            <select value={form.tela} onChange={(e) => setForm((p) => ({ ...p, tela: e.target.value }))} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:border-violet-400">
              <option value="">— Seleccionar —</option>
              {TELAS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1.5">Costo de producción ($)</label>
          <input type="number" value={form.costo} onChange={(e) => setForm((p) => ({ ...p, costo: parseFloat(e.target.value) || 0 }))} min="0" step="0.01" className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400" />
        </div>

        <div className="bg-stone-50 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-stone-500">Precio de venta estimado</p>
            <p className="text-xs text-stone-400">costo × {MARGEN_DEFAULT}</p>
          </div>
          <span className="text-xl font-bold text-violet-700">${precioVenta.toFixed(0)}</span>
        </div>

        <button
          onClick={guardar}
          disabled={saving}
          className={`w-full py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition ${saved ? 'bg-emerald-600 text-white' : 'bg-stone-900 hover:bg-stone-800 text-white disabled:opacity-50'}`}
        >
          {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}
        </button>
      </div>

      {/* Timeline de los 18 pasos */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Checklist de desarrollo (18 pasos)</p>
        <TimelinePasos proyectoId={proyecto.id} pasos={proyecto.pasos} />
      </div>
    </div>
  );
}
