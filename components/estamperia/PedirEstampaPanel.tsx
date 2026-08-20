'use client';

import { useState, useEffect, useMemo } from 'react';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { toast } from '@/components/ui/Toaster';
import { TALLES_COMUNES, TALLES_DEFAULT } from '@/lib/validators/produccion';

// Pedir el DTF de estampas que todavía no se venden (lanzamiento). El otro camino
// —reposición— nace del cálculo de stock en `QueEstamparClient`; acá el pedido nace de
// la estampa, así que se elige el liso a mano por cada diseño (una tanda de lanzamiento
// mezcla lisos: remeras boxy, over, buzos).
// El liso NO se descuenta acá: se descuenta al confirmar en Reposición → Órdenes.

interface EstampaSel { id: string; codigoInterno: string; nombreComercial: string | null }
interface Liso { sku: string; talles: Record<string, number>; total: number }

const ordenTalle = (t: string) => {
  const i = (TALLES_DEFAULT as readonly string[]).indexOf(t);
  return i === -1 ? 99 : i;
};

export function PedirEstampaPanel({ estampas, onCreada, onCancelar }: {
  estampas: EstampaSel[];
  onCreada: () => void;
  onCancelar: () => void;
}) {
  const [lisos, setLisos] = useState<Liso[]>([]);
  const [lisoPorEstampa, setLisoPorEstampa] = useState<Record<string, string>>({});
  const [cant, setCant] = useState<Record<string, string>>({}); // `${estampaId}::${talle}`
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/reposicion/lisos').then((r) => r.ok ? r.json() : []).then((l) => { if (Array.isArray(l)) setLisos(l); }).catch(() => {});
  }, []);

  const lisoBySku = useMemo(() => new Map(lisos.map((l) => [l.sku, l])), [lisos]);

  // Las columnas salen de los lisos elegidos: pedir un talle que el liso no tiene es
  // pedir algo que nunca se va a poder descontar. Sin liso todavía, los comunes.
  const talles = useMemo(() => {
    const elegidos = [...new Set(Object.values(lisoPorEstampa).filter(Boolean))];
    const t = new Set<string>();
    for (const sku of elegidos) for (const k of Object.keys(lisoBySku.get(sku)?.talles ?? {})) t.add(k);
    if (t.size === 0) return [...TALLES_COMUNES] as string[];
    return [...t].sort((a, b) => ordenTalle(a) - ordenTalle(b));
  }, [lisoPorEstampa, lisoBySku]);

  const num = (eid: string, t: string) => parseInt(cant[`${eid}::${t}`] ?? '') || 0;
  const total = estampas.reduce((s, e) => s + talles.reduce((s2, t) => s2 + num(e.id, t), 0), 0);

  const aplicarLisoATodas = (sku: string) => {
    setLisoPorEstampa(Object.fromEntries(estampas.map((e) => [e.id, sku])));
  };

  const crear = async () => {
    const items: { estampaId: string; skuLiso: string; talle: string; cantidad: number }[] = [];
    for (const e of estampas) {
      const sku = lisoPorEstampa[e.id];
      const suyos = talles.filter((t) => num(e.id, t) > 0);
      if (suyos.length === 0) continue;
      if (!sku) { toast.error(`Elegí el liso de ${e.codigoInterno}`); return; }
      for (const t of suyos) items.push({ estampaId: e.id, skuLiso: sku, talle: t, cantidad: num(e.id, t) });
    }
    if (items.length === 0) { toast.error('Cargá cuántas prendas de cada talle'); return; }

    setSaving(true);
    const r = await fetch('/api/reposicion/orden-estampa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'estampa', origen: 'lanzamiento', notas: notas.trim() || undefined, items }),
    });
    if (r.ok) {
      const d = await r.json().catch(() => ({ estampasPedidas: 0 }));
      const prendas = items.reduce((s, i) => s + i.cantidad, 0);
      // Sólo las que estaban en «Pensada» se mueven, así que el cartel dice cuántas se
      // movieron de verdad en vez de afirmar el cambio para todas.
      const movidas = d.estampasPedidas > 0 ? ` · ${d.estampasPedidas} pasa${d.estampasPedidas !== 1 ? 'n' : ''} a «DTF pedido»` : '';
      toast.success(`Orden creada · ${prendas} prenda${prendas !== 1 ? 's' : ''}${movidas}`);
      onCreada();
    } else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo crear la orden'); }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-fuchsia-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-stone-800">Pedir {estampas.length} estampa{estampas.length !== 1 ? 's' : ''} (lanzamiento)</h3>
        <button type="button" onClick={onCancelar} className="text-xs text-stone-400 hover:text-stone-700">✕ Cancelar</button>
      </div>
      <p className="text-xs text-stone-500">
        Crea una orden de estampa en Reposición → Órdenes. El liso <strong>no</strong> se descuenta ahora:
        se descuenta al confirmar ahí lo que realmente se estampó.
      </p>

      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[16rem]">
          <label className="text-xs text-stone-500 block mb-1">Poner el mismo liso en todas</label>
          <Select fullWidth value="" onChange={(e) => { if (e.target.value) aplicarLisoATodas(e.target.value); }}>
            <option value="">— elegí un liso —</option>
            {lisos.map((l) => <option key={l.sku} value={l.sku}>{l.sku} · {l.total} en stock</option>)}
          </Select>
        </div>
        <div className="flex-1 min-w-[14rem]">
          <Input label="Notas de la orden" fullWidth value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="(opcional)" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-widest text-stone-400">
              <th className="text-left font-semibold py-1.5 pr-3">Estampa</th>
              <th className="text-left font-semibold py-1.5 pr-3">Liso</th>
              {talles.map((t) => <th key={t} className="font-semibold py-1.5 px-1 w-20 text-center">{t}</th>)}
              <th className="font-semibold py-1.5 pl-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {estampas.map((e) => {
              const sku = lisoPorEstampa[e.id] ?? '';
              const liso = sku ? lisoBySku.get(sku) : undefined;
              const fila = talles.reduce((s, t) => s + num(e.id, t), 0);
              return (
                <tr key={e.id}>
                  <td className="py-2 pr-3">
                    <span className="font-mono text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded">{e.codigoInterno}</span>
                    {e.nombreComercial && <span className="text-stone-500 text-xs ml-2">{e.nombreComercial}</span>}
                  </td>
                  <td className="py-2 pr-3 min-w-[13rem]">
                    <Select fullWidth value={sku} onChange={(ev) => setLisoPorEstampa((p) => ({ ...p, [e.id]: ev.target.value }))}>
                      <option value="">— liso —</option>
                      {lisos.map((l) => <option key={l.sku} value={l.sku}>{l.sku}</option>)}
                    </Select>
                  </td>
                  {talles.map((t) => {
                    const hay = liso?.talles[t];
                    const pedido = num(e.id, t);
                    return (
                      <td key={t} className="py-2 px-1 align-top">
                        <NumInput value={pedido} min="0"
                          onChange={(n) => setCant((p) => ({ ...p, [`${e.id}::${t}`]: String(Math.max(0, n)) }))}
                          className="w-full text-center px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400" />
                        {sku && (
                          <p className={`text-[10px] text-center mt-0.5 ${hay == null ? 'text-stone-300' : pedido > hay ? 'text-amber-600 font-semibold' : 'text-stone-400'}`}>
                            {hay == null ? 'sin talle' : `hay ${hay}`}
                          </p>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2 pl-3 text-right tabular-nums font-semibold text-stone-700">{fila || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-stone-500">Total del pedido: <strong className="text-stone-800">{total}</strong> prenda{total !== 1 ? 's' : ''}</p>
        <Button onClick={crear} isLoading={saving} disabled={total === 0}>Crear orden</Button>
      </div>
    </div>
  );
}
