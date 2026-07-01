'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RegistrarCorteForm, type CortePrefill } from './RegistrarCorteForm';
import { CorteRevertir } from './CorteRevertir';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { toast } from '@/components/ui/Toaster';

const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

interface Resumen {
  cantidad: number;
  kgTotal: number;
  metrosTotal: number;
  metrosPorU: number;
  kgPorU: number;
  cortador: string | null;
  talles: { talle: string; cantidad: number }[];
}

// Ficha ya cargada: muestra el resumen del corte y permite EDITARLO sin re-hacer todo.
// "Editar" revierte (repone el stock) y abre el formulario pre-cargado con lo que había;
// ajustás y guardás como un registro normal. El impacto neto en rollos es la diferencia.
export function CorteEditor({ ordenId, sku, cantidadPlanificada, marca, resumen, prefill }: {
  ordenId: string; sku: string; cantidadPlanificada: number; marca: string | null; resumen: Resumen; prefill: CortePrefill;
}) {
  const [editando, setEditando] = useState(false);
  const [revirtiendo, setRevirtiendo] = useState(false);

  const editar = async () => {
    const ok = await confirmAsync({
      message: 'Se va a reponer el stock consumido y abrir la ficha para ajustar. Al guardar, los rollos se descuentan de nuevo con los valores nuevos (el impacto neto es la diferencia). Si salís sin guardar, la ficha queda sin cargar.',
      confirmLabel: 'Editar',
    });
    if (!ok) return;
    setRevirtiendo(true);
    const r = await fetch(`/api/produccion/cola/${ordenId}/corte/revertir`, { method: 'POST' });
    if (r.ok) { setEditando(true); toast.success('Ficha lista para ajustar'); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo abrir para editar'); }
    setRevirtiendo(false);
  };

  if (editando) {
    return (
      <div className="space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800">
          Editando la ficha. Ajustá lo que necesites y guardá. <button onClick={() => window.location.reload()} className="underline font-semibold">Cancelar</button>
        </div>
        <RegistrarCorteForm ordenId={ordenId} sku={sku} cantidadPlanificada={cantidadPlanificada} marca={marca} prefill={prefill} />
      </div>
    );
  }

  return (
    <>
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-6">
        <h3 className="text-sm font-bold text-emerald-800 mb-3">Corte ya registrado</h3>
        <div className="space-y-2 text-sm">
          <p><span className="text-emerald-600">Total cortadas:</span> <strong>{resumen.cantidad} unidades</strong></p>
          <p><span className="text-emerald-600">Consumo total:</span> <strong>{resumen.kgTotal > 0 ? `${fmt(resumen.kgTotal)} kg` : ''}{resumen.kgTotal > 0 && resumen.metrosTotal > 0 ? ' · ' : ''}{resumen.metrosTotal > 0 ? `${fmt(resumen.metrosTotal)} m` : ''}{resumen.kgTotal === 0 && resumen.metrosTotal === 0 ? '--' : ''}</strong></p>
          <p><span className="text-emerald-600">Por unidad:</span> <strong>{resumen.metrosPorU > 0 ? `${fmt(resumen.metrosPorU)} m/u` : '--'}{resumen.kgPorU > 0 ? ` · ${fmt(resumen.kgPorU)} kg/u` : ''}</strong></p>
          {resumen.cortador && <p><span className="text-emerald-600">Cortador:</span> <strong>{resumen.cortador}</strong></p>}
        </div>
        <div className="mt-4 pt-4 border-t border-emerald-200">
          <p className="text-xs text-emerald-700 uppercase tracking-widest font-bold mb-2">Desglose por talle</p>
          <div className="flex flex-wrap gap-3">
            {resumen.talles.map((c) => (
              <div key={c.talle} className="bg-white rounded-lg px-3 py-1.5 text-sm border border-emerald-200">
                <span className="text-emerald-600">{c.talle}:</span> <strong>{c.cantidad}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={editar} disabled={revirtiendo}
          className="bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
          {revirtiendo ? 'Abriendo…' : '✎ Editar ficha'}
        </button>
        <CorteRevertir ordenId={ordenId} />
        <Link href={`/produccion/${ordenId}`} className="px-4 py-2.5 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition">
          Volver al detalle
        </Link>
      </div>
    </>
  );
}
