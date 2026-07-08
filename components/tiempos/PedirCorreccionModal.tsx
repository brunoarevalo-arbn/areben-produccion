'use client';

import { useState } from 'react';
import { TiemposProduccion } from '@/types/tiempos';
import { MAQUINAS } from '@/lib/constants/maquinas';
import { toast } from '@/components/ui/Toaster';

interface OrdenCola { id: string; sku: string | null; marca: string }

// Modal para que la costurera pida corregir el SKU y/o la máquina de un registro
// propio del día. Genera una solicitud que el admin aprueba (no cambia solo).
export function PedirCorreccionModal({ registro, ordenes, onClose, onEnviada }: {
  registro: TiemposProduccion;
  ordenes: OrdenCola[];
  onClose: () => void;
  onEnviada: () => void;
}) {
  const skuActual = registro.sku ?? '';
  const maquinaActual = registro.maquina ?? '';
  const [sku, setSku] = useState(skuActual);
  const [maquina, setMaquina] = useState(maquinaActual);
  const [saving, setSaving] = useState(false);

  // SKUs de la cola de costura + el actual (por si ya no está en la cola).
  const skus = [...new Set([skuActual, ...ordenes.map((o) => o.sku).filter(Boolean) as string[]].filter(Boolean))];

  const enviar = async () => {
    const skuNuevo = sku !== skuActual ? sku : undefined;
    const maquinaNueva = maquina !== maquinaActual ? maquina : undefined;
    if (skuNuevo === undefined && maquinaNueva === undefined) { toast.error('No cambiaste nada'); return; }
    setSaving(true);
    const r = await fetch('/api/tiempos/solicitudes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tiempoId: registro.id, skuNuevo, maquinaNueva }),
    });
    if (r.ok) { toast.success('Solicitud enviada — la revisa el admin'); onEnviada(); onClose(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo enviar'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-base font-bold text-stone-900">Pedir corrección</h3>
          <p className="text-xs text-stone-500 mt-0.5">{registro.actividad} · {registro.minutosNetos.toFixed(0)} min. Lo revisa el admin.</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1 block">SKU</label>
          <select value={sku} onChange={(e) => setSku(e.target.value)}
            className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400">
            <option value="">(sin SKU)</option>
            {skus.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1 block">Máquina</label>
          <select value={maquina} onChange={(e) => setMaquina(e.target.value)}
            className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400">
            <option value="">(sin máquina)</option>
            {[...new Set([maquinaActual, ...MAQUINAS].filter(Boolean))].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-stone-500 hover:bg-stone-100 transition">Cancelar</button>
          <button onClick={enviar} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-stone-900 transition">
            {saving ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </div>
      </div>
    </div>
  );
}
