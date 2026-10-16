'use client';

import { useState } from 'react';
import { TiemposProduccion } from '@/types/tiempos';
import { MAQUINAS } from '@/lib/constants/maquinas';
import { PARTE_COMPARTIDA } from '@/lib/constants/partes';
import { toast } from '@/components/ui/Toaster';

interface OrdenCola { id: string; sku: string | null; marca: string; partes?: string[] }

// Modal para que la costurera pida corregir el SKU, la máquina y/o la PIEZA (bikini) de un
// registro propio del día. Genera una solicitud que el admin aprueba (no cambia solo).
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
  const parteActual = registro.parte ?? '';
  const [parte, setParte] = useState(parteActual);
  const [saving, setSaving] = useState(false);

  // SKUs de la cola de costura + el actual (por si ya no está en la cola).
  const skus = [...new Set([skuActual, ...ordenes.map((o) => o.sku).filter(Boolean) as string[]].filter(Boolean))];

  // Las piezas del SKU ELEGIDO: si pasa a una prenda que no se parte, la pieza se va.
  const partes = ordenes.find((o) => o.sku === sku)?.partes ?? (sku === skuActual && parteActual ? [parteActual] : []);
  const opcionesParte = partes.length > 0 ? [...new Set([...partes, PARTE_COMPARTIDA])] : [];
  const parteFinal = opcionesParte.length > 0 ? parte : '';

  const enviar = async () => {
    const skuNuevo = sku !== skuActual ? sku : undefined;
    const maquinaNueva = maquina !== maquinaActual ? maquina : undefined;
    const parteNueva = parteFinal !== parteActual ? parteFinal : undefined;
    if (skuNuevo === undefined && maquinaNueva === undefined && parteNueva === undefined) { toast.error('No cambiaste nada'); return; }
    // Vacía y sin default (como en la tablet): en la bikini la pieza la dice ella.
    if (opcionesParte.length > 0 && !parteFinal) { toast.error('Elegí la pieza'); return; }
    setSaving(true);
    const r = await fetch('/api/tiempos/solicitudes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tiempoId: registro.id, skuNuevo, maquinaNueva, parteNueva }),
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

        {opcionesParte.length > 0 && (
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1 block">Pieza</label>
            <div className="flex flex-wrap gap-2">
              {opcionesParte.map((p) => (
                <button key={p} type="button" onClick={() => setParte(p)} aria-pressed={parte === p}
                  className={`px-3 py-2 rounded-xl border text-sm font-semibold transition ${parte === p ? 'border-amber-400 bg-amber-50 text-stone-900' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                  {p === PARTE_COMPARTIDA ? 'Las dos' : p}
                </button>
              ))}
            </div>
          </div>
        )}

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
