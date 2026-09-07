'use client';

import { useState, useEffect, useCallback } from 'react';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from '@/components/ui/Toaster';
import { nombreItemOrden } from '@/lib/produccion/ordenEstampa';
import { consumoDtfOrden, contrastarDtf } from '@/lib/costos/ordenEstampaDtf';
import type { DtfConfig } from '@/lib/costos/estampaCosto';

interface OrdenItem { id: string; gnId: number | null; gnNombre: string | null; estampa: { codigoInterno: string; nombreComercial: string | null; anchoCm: number; largoCm: number; ancho2Cm: number; largo2Cm: number } | null; skuLiso: string; talle: string; cantidad: number; confirmado: number; estampasPrenda?: { anchoCm: number; largoCm: number; ancho2Cm: number; largo2Cm: number }[]; }
interface CompraDtfOrden { id: string; fecha: string; metros: number; precioMetro: number; flete: number; gastoId: string | null }
interface OrdenEstampa { id: string; creadoAt: string; creadoPor: string; estado: string; tipo: string; origen: string; notas: string | null; precioMetroDtf?: number | string; comprasDtf?: CompraDtfOrden[]; items: OrdenItem[]; }

const inp = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';

// Lo que la TIRA dice que hace falta contra lo que se compró de verdad. Es el chequeo que
// caza al primero que se rompa: una medida mal cargada, un precio mal, o un encastre peor
// del previsto. Antes vivía en un script que había que acordarse de correr.
function ContrasteDtfLinea({ orden, dtf }: { orden: OrdenEstampa; dtf: DtfConfig }) {
  const consumo = consumoDtfOrden(
    orden.items.map((i) => ({ talle: i.talle, cantidad: i.cantidad, estampas: i.estampasPrenda ?? [] })),
    dtf,
  );
  const comprados = (orden.comprasDtf ?? []).reduce((s, c) => s + c.metros, 0);
  const k = contrastarDtf(consumo, (orden.comprasDtf ?? []).length ? comprados : null);

  // Sin medidas no se muestra un metraje parcial: se dice qué falta.
  if (consumo.metros == null) {
    return <span className="text-xs px-2 py-0.5 rounded-lg bg-stone-100 text-stone-500" title={consumo.motivo ?? ''}>DTF sin medir</span>;
  }
  const tira = `${consumo.metros.toFixed(1)} m`;
  if (k.metrosComprados == null) {
    return <span className="text-xs px-2 py-0.5 rounded-lg bg-violet-50 text-violet-700" title="Lo que pide esta orden según la tira. No hay ninguna compra de DTF vinculada, así que no hay con qué contrastarlo.">la tira dice {tira} · sin compra vinculada</span>;
  }
  // Un desvío chico es normal (se compra en metros redondos); uno grande dice que algo
  // de las tres cosas está mal, y por eso se colorea en vez de sólo mostrarse.
  const d = k.desvioPct!;
  const color = Math.abs(d) <= 10 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-100 text-amber-800 font-semibold';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-lg ${color}`}
      title={`La tira dice ${tira} para las ${consumo.prendas} prendas. Se compraron ${k.metrosComprados!.toFixed(1)} m ⇒ ${k.sobranMetros! >= 0 ? 'sobran' : 'FALTAN'} ${Math.abs(k.sobranMetros!).toFixed(1)} m.`}>
      la tira dice {tira} · se compraron {k.metrosComprados!.toFixed(1)} m ({d >= 0 ? '+' : ''}{Math.round(d)}%)
    </span>
  );
}

export function OrdenesEstampaClient() {
  const [ordenes, setOrdenes] = useState<OrdenEstampa[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmEdit, setConfirmEdit] = useState<Record<string, string>>({});
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [verHechas, setVerHechas] = useState(false);
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({}); // liso colapsable: `${ordenId}::${liso}`
  // El ancho del rollo y la separación salen de la config: sin eso no se puede saber
  // cuántas estampas entran por fila, y el metraje sería inventado.
  const [dtf, setDtf] = useState<DtfConfig | null>(null);

  const cargar = useCallback(async () => {
    const r = await fetch('/api/reposicion/orden-estampa');
    if (r.ok) setOrdenes(await r.json());
    setLoading(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    fetch('/api/estampas/config').then((r) => r.ok ? r.json() : null)
      .then((c) => { if (c) setDtf({ dtfPrecioMetro: c.dtfPrecioMetro, dtfAnchoCm: c.dtfAnchoCm, dtfSeparacionCm: c.dtfSeparacionCm }); }).catch(() => {});
  }, []);

  const confirmarOrden = async (o: OrdenEstampa) => {
    // El input es una carga parcial ("cuántas ahora"); se suma a lo ya confirmado.
    const items = o.items
      .filter((it) => (parseInt(confirmEdit[it.id] ?? '') || 0) > 0)
      .map((it) => ({ id: it.id, confirmado: Math.min(it.cantidad, it.confirmado + (parseInt(confirmEdit[it.id]) || 0)) }));
    if (items.length === 0) { toast.error('Cargá cuántas estampaste'); return; }
    setConfirmando(o.id);
    const r = await fetch(`/api/reposicion/orden-estampa/${o.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
    if (r.ok) {
      const upd = await r.json();
      setOrdenes((prev) => prev.map((x) => x.id === o.id ? upd : x));
      setConfirmEdit((p) => { const n = { ...p }; for (const it of items) delete n[it.id]; return n; });
      toast.success('Estampado confirmado · liso descontado');
    } else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo confirmar'); }
    setConfirmando(null);
  };

  const borrarOrden = async (id: string) => {
    const r = await fetch(`/api/reposicion/orden-estampa/${id}`, { method: 'DELETE' });
    if (r.ok) setOrdenes((prev) => prev.filter((o) => o.id !== id));
  };

  const abiertas = ordenes.filter((o) => o.estado !== 'hecha');
  const hechas = ordenes.filter((o) => o.estado === 'hecha');

  const renderOrden = (o: OrdenEstampa) => {
    const porLiso = new Map<string, OrdenItem[]>();
    for (const it of o.items) { if (!porLiso.has(it.skuLiso)) porLiso.set(it.skuLiso, []); porLiso.get(it.skuLiso)!.push(it); }
    const totalPed = o.items.reduce((s, i) => s + i.cantidad, 0);
    const totalConf = o.items.reduce((s, i) => s + i.confirmado, 0);
    const totalPend = totalPed - totalConf;
    const estadoColor = o.estado === 'hecha' ? 'bg-emerald-100 text-emerald-700' : o.estado === 'parcial' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700';
    const hayCambios = o.items.some((it) => (parseInt(confirmEdit[it.id] ?? '') || 0) > 0);
    const esProd = o.tipo === 'produccion';
    const esLanzamiento = o.origen === 'lanzamiento';
    const hechas = esProd ? 'producidas' : 'estampadas';
    return (
      <div key={o.id} className={`rounded-xl border p-4 ${o.estado === 'hecha' ? 'border-stone-200 bg-stone-50/50' : 'border-amber-200'}`}>
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <span className="text-sm font-semibold text-stone-800">
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded mr-2 ${esProd ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'}`}>{esProd ? 'producción' : 'estampa'}</span>
            {esLanzamiento && <span className="text-xs font-semibold px-1.5 py-0.5 rounded mr-2 bg-fuchsia-100 text-fuchsia-700">lanzamiento</span>}
            {new Date(o.creadoAt).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            <span className="text-stone-400 font-normal"> · {o.creadoPor} · {totalConf}/{totalPed} {hechas}</span>
            {/* El $/metro que regía cuando se pidió. Congelarlo es lo que hace que subir el
                precio de hoy no reescriba lo que ya se produjo. 0 = orden anterior al
                snapshot: de ésas no se sabe el precio y caen al vigente. */}
            {Number(o.precioMetroDtf) > 0
              ? <span className="text-stone-400 font-normal" title="Precio del DTF congelado al crear la orden: cambiar el de hoy no la toca."> · DTF ${Number(o.precioMetroDtf).toLocaleString('es-AR')}/m</span>
              : <span className="text-stone-300 font-normal" title="Orden anterior al snapshot de precio: se costea al precio vigente."> · DTF sin precio propio</span>}
            {totalPend > 0
              ? <span className="text-xs font-semibold text-amber-600 ml-2">{totalPend} pendientes</span>
              : <span className="text-xs font-semibold text-emerald-600 ml-2">completa ✓</span>}
          </span>
          <div className="flex items-center gap-2">
            {dtf && <ContrasteDtfLinea orden={o} dtf={dtf} />}
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${estadoColor}`}>{o.estado}</span>
            {totalConf > 0 && (
              <a href={`/reposicion/orden/${o.id}/remito`} target="_blank" rel="noopener noreferrer" className="text-xs px-2.5 py-1 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-100 transition font-semibold">📄 Remito{o.estado === 'parcial' ? ' parcial' : ''}</a>
            )}
            <button onClick={() => borrarOrden(o.id)} aria-label="Borrar" className="text-stone-300 hover:text-red-500 px-1 leading-none text-lg">×</button>
          </div>
        </div>
        <div className="space-y-1.5">
          {[...porLiso.entries()].map(([liso, items]) => {
            const lPed = items.reduce((s, i) => s + i.cantidad, 0);
            const lConf = items.reduce((s, i) => s + i.confirmado, 0);
            const lPend = lPed - lConf;
            const key = `${o.id}::${liso}`;
            const defOpen = lPend > 0 && o.estado !== 'hecha';
            const open = abiertos[key] ?? defOpen;
            return (
            <div key={liso} className="rounded-lg border border-stone-100">
              <button type="button" onClick={() => setAbiertos((p) => ({ ...p, [key]: !(p[key] ?? defOpen) }))}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left">
                <span className="font-mono text-xs text-stone-600">{liso}</span>
                <span className="flex items-center gap-2 text-xs shrink-0">
                  <span className="text-stone-500">{lConf}/{lPed}</span>
                  {lPend > 0
                    ? <span className="font-semibold text-amber-600">{lPend} pend.</span>
                    : <span className="font-semibold text-emerald-600">✓</span>}
                  <span className="text-stone-400">{open ? '▾' : '▸'}</span>
                </span>
              </button>
              {open && (
                <div className="px-2.5 pb-1.5 divide-y divide-stone-100">
                  {items.map((it) => {
                    const pend = it.cantidad - it.confirmado;
                    const completo = pend <= 0;
                    return (
                    <div key={it.id} className="py-2">
                      <p className="text-sm text-stone-800">{nombreItemOrden(it)} · <strong>{it.talle}</strong></p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-1">
                        <span className="text-stone-400">pedido {it.cantidad}</span>
                        <span className="text-stone-500">{esProd ? 'producidas' : 'estampadas'} <strong className="text-stone-700">{it.confirmado}</strong></span>
                        <span className={`font-semibold ${completo ? 'text-emerald-600' : 'text-amber-600'}`}>{completo ? 'completo ✓' : `pend. ${pend}`}</span>
                        <span className="flex-1" />
                        {!completo && o.estado !== 'hecha' && (
                          <span className="flex items-center gap-1">
                            <span className="text-stone-400">+</span>
                            <NumInput value={parseInt(confirmEdit[it.id] ?? '') || 0} min="0"
                              onChange={(n) => setConfirmEdit((p) => ({ ...p, [it.id]: String(Math.max(0, Math.min(n, it.cantidad - it.confirmado))) }))}
                              className={`w-16 text-right ${inp}`} />
                          </span>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
            );
          })}
        </div>
        {o.estado !== 'hecha' && (
          <div className="mt-3 pt-2 border-t border-stone-100 flex justify-end">
            <Button variant="primary" size="sm" onClick={() => confirmarOrden(o)} isLoading={confirmando === o.id} disabled={!hayCambios}>Confirmar {esProd ? 'producido' : 'estampado'}</Button>
          </div>
        )}
      </div>
    );
  };

  if (loading) return <p className="text-sm text-stone-400">Cargando…</p>;

  return (
    <div className="space-y-3">
      {abiertas.length === 0 && hechas.length === 0 && (
        <EmptyState message="Todavía no hay órdenes. Generá una desde Qué estampar." />
      )}
      {abiertas.map(renderOrden)}
      {hechas.length > 0 && (
        <div className="pt-2">
          <button onClick={() => setVerHechas((v) => !v)} className="text-xs text-stone-500 hover:text-stone-800 font-semibold">
            {verHechas ? '▲ Ocultar' : '▼ Ver'} hechas ({hechas.length})
          </button>
          {verHechas && <div className="space-y-3 mt-3">{hechas.map(renderOrden)}</div>}
        </div>
      )}
    </div>
  );
}
