'use client';

import { useState } from 'react';
import { RegistrarCorteForm, type CortePrefill } from './RegistrarCorteForm';
import { toast } from '@/components/ui/Toaster';

interface Hermana { id: string; sku: string | null; }

interface TizadaGuardada { nombre?: string; modo?: 'tizada' | 'manual'; metros?: string; unidades?: string }
interface FichaResp {
  cortadorId?: string | null;
  costoCorte?: string | number | null;
  avios?: { etiquetaId: string; cantidad: number }[];
  cortesPorTalle?: { talle: string; cantidad: number }[];
  movimientosInsumo?: { tipo: string; cantidad: string | number; rollo?: { insumo?: { rinde: string | number | null } } | null }[];
  fichaCorteData?: { tizadas?: TizadaGuardada[]; costoCorte?: number | string; modoCosto?: 'total' | 'unidad' } | null;
}

// Envuelve el form de corte y permite, en una OP de un lote, copiar la ficha de una
// hermana que ya la tiene: prellena avíos, cortador, costo y talles (la tela se elige
// aparte porque cada color usa la suya).
export function RegistrarCorteConCopia({ ordenId, sku, cantidadPlanificada, marca, hermanas, volverA, initialPrefill }: {
  ordenId: string; sku: string; cantidadPlanificada: number; marca: string | null; hermanas: Hermana[]; volverA?: string; initialPrefill?: CortePrefill;
}) {
  const [prefill, setPrefill] = useState<CortePrefill | undefined>(initialPrefill);
  const [formKey, setFormKey] = useState(0);
  const [copiando, setCopiando] = useState(false);
  const [desde, setDesde] = useState(hermanas[0]?.id ?? '');

  const copiar = async () => {
    if (!desde) return;
    setCopiando(true);
    const r = await fetch(`/api/produccion/cola/${desde}/corte`);
    if (r.ok) {
      const d: FichaResp = await r.json();
      const talles = (d.cortesPorTalle ?? []).map((c) => ({ talle: c.talle, cantidad: c.cantidad }));
      const unidades = talles.reduce((s, t) => s + t.cantidad, 0);
      // Receta de tizadas SEPARADAS desde la ficha guardada (cuerpo, puño, manga…), sin
      // rollos (cada color usa su tela). Si la hermana es vieja (sin fichaCorteData), se
      // cae al modo anterior: una sola tizada con el total de metros consumidos.
      const tizadasGuardadas = (d.fichaCorteData?.tizadas ?? []).filter((t) => t && (t.metros || t.unidades || t.nombre));
      const tizadasReceta = tizadasGuardadas.length
        ? tizadasGuardadas.map((t) => ({ nombre: t.nombre ?? '', modo: (t.modo ?? 'tizada'), metros: t.metros ?? '', unidades: t.unidades ?? '1' }))
        : undefined;
      const metros = (d.movimientosInsumo ?? [])
        .filter((m) => m.tipo === 'CONSUMO')
        .reduce((s, m) => s + Math.abs(Number(m.cantidad)) * Number(m.rollo?.insumo?.rinde ?? 0), 0);
      // Costo de corte: replicar la lógica del SKU copiado. Si la hermana tiene
      // fichaCorteData, usar el valor CRUDO ingresado + su modo (total/unidad). Si no
      // (ficha vieja), caer al total guardado en la OP como "total".
      const fd = d.fichaCorteData;
      const costoCorte = fd?.costoCorte != null ? Number(fd.costoCorte) : (d.costoCorte ? Number(d.costoCorte) : undefined);
      const modoCosto = fd?.modoCosto ?? 'total';
      setPrefill({
        avios: (d.avios ?? []).map((a) => ({ etiquetaId: a.etiquetaId, cantidad: a.cantidad })),
        cortadorId: d.cortadorId ?? null,
        costoCorte,
        modoCosto,
        talles,
        tizadasReceta,
        tizada: !tizadasReceta && unidades > 0 && metros > 0 ? { metros: Math.round(metros * 100) / 100, unidades } : undefined,
      });
      setFormKey((k) => k + 1);
      toast.success('Ficha copiada — solo elegí el rollo del color (el rinde ya viene)');
    } else {
      toast.error('No se pudo copiar la ficha');
    }
    setCopiando(false);
  };

  return (
    <div className="space-y-4">
      {initialPrefill?.fichaData && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-blue-900">
          El cortador ya cargó las tizadas, talles y precio. <strong>Asigná la tela (rollo)</strong> de cada tizada y guardá.
        </div>
      )}
      {hermanas.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
          <span className="text-sm text-blue-900">
            Copiar ficha de una hermana <span className="text-blue-700/80">(avíos, cortador, costo, talles y rinde; solo elegís el rollo del color)</span>:
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
      <RegistrarCorteForm key={formKey} ordenId={ordenId} sku={sku} cantidadPlanificada={cantidadPlanificada} marca={marca} prefill={prefill} volverA={volverA} />
    </div>
  );
}
