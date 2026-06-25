'use client';

import { useState } from 'react';
import { RegistrarCorteForm, type CortePrefill } from './RegistrarCorteForm';
import { toast } from '@/components/ui/Toaster';

interface Hermana { id: string; sku: string | null; }

interface FichaResp {
  cortadorId?: string | null;
  costoCorte?: string | number | null;
  avios?: { etiquetaId: string; cantidad: number }[];
  cortesPorTalle?: { talle: string; cantidad: number }[];
}

// Envuelve el form de corte y permite, en una OP de un lote, copiar la ficha de una
// hermana que ya la tiene: prellena avíos, cortador, costo y talles (la tela se elige
// aparte porque cada color usa la suya).
export function RegistrarCorteConCopia({ ordenId, sku, cantidadPlanificada, marca, hermanas }: {
  ordenId: string; sku: string; cantidadPlanificada: number; marca: string | null; hermanas: Hermana[];
}) {
  const [prefill, setPrefill] = useState<CortePrefill | undefined>();
  const [formKey, setFormKey] = useState(0);
  const [copiando, setCopiando] = useState(false);
  const [desde, setDesde] = useState(hermanas[0]?.id ?? '');

  const copiar = async () => {
    if (!desde) return;
    setCopiando(true);
    const r = await fetch(`/api/produccion/cola/${desde}/corte`);
    if (r.ok) {
      const d: FichaResp = await r.json();
      setPrefill({
        avios: (d.avios ?? []).map((a) => ({ etiquetaId: a.etiquetaId, cantidad: a.cantidad })),
        cortadorId: d.cortadorId ?? null,
        costoCorte: d.costoCorte ? Number(d.costoCorte) : undefined,
        talles: (d.cortesPorTalle ?? []).map((c) => ({ talle: c.talle, cantidad: c.cantidad })),
      });
      setFormKey((k) => k + 1);
      toast.success('Ficha copiada — ahora elegí la tela del color');
    } else {
      toast.error('No se pudo copiar la ficha');
    }
    setCopiando(false);
  };

  return (
    <div className="space-y-4">
      {hermanas.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
          <span className="text-sm text-blue-900">
            Copiar ficha de una hermana <span className="text-blue-700/80">(avíos, cortador, costo y talles; la tela la elegís acá)</span>:
          </span>
          <select value={desde} onChange={(e) => setDesde(e.target.value)}
            className="px-2 py-1.5 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-400">
            {hermanas.map((h) => <option key={h.id} value={h.id}>{h.sku ?? h.id}</option>)}
          </select>
          <button onClick={copiar} disabled={copiando || !desde}
            className="text-xs px-3 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-50 font-semibold transition">
            {copiando ? '...' : 'Copiar'}
          </button>
        </div>
      )}
      <RegistrarCorteForm key={formKey} ordenId={ordenId} sku={sku} cantidadPlanificada={cantidadPlanificada} marca={marca} prefill={prefill} />
    </div>
  );
}
