'use client';

import { useState, useEffect, useCallback } from 'react';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from '@/components/ui/Toaster';

interface OrdenItem { id: string; gnId: number; gnNombre: string | null; skuLiso: string; talle: string; cantidad: number; confirmado: number; }
interface OrdenEstampa { id: string; creadoAt: string; creadoPor: string; estado: string; tipo: string; notas: string | null; items: OrdenItem[]; }

const inp = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';

export function OrdenesEstampaClient() {
  const [ordenes, setOrdenes] = useState<OrdenEstampa[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmEdit, setConfirmEdit] = useState<Record<string, string>>({});
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [verHechas, setVerHechas] = useState(false);

  const cargar = useCallback(async () => {
    const r = await fetch('/api/reposicion/orden-estampa');
    if (r.ok) setOrdenes(await r.json());
    setLoading(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

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
    const hechas = esProd ? 'producidas' : 'estampadas';
    return (
      <div key={o.id} className={`rounded-xl border p-4 ${o.estado === 'hecha' ? 'border-stone-200 bg-stone-50/50' : 'border-amber-200'}`}>
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <span className="text-sm font-semibold text-stone-800">
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded mr-2 ${esProd ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'}`}>{esProd ? 'producción' : 'estampa'}</span>
            {new Date(o.creadoAt).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            <span className="text-stone-400 font-normal"> · {o.creadoPor} · {totalConf}/{totalPed} {hechas}</span>
            {totalPend > 0
              ? <span className="text-xs font-semibold text-amber-600 ml-2">{totalPend} pendientes</span>
              : <span className="text-xs font-semibold text-emerald-600 ml-2">completa ✓</span>}
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${estadoColor}`}>{o.estado}</span>
            {o.estado === 'hecha' && (
              <a href={`/reposicion/orden/${o.id}/remito`} target="_blank" rel="noopener noreferrer" className="text-xs px-2.5 py-1 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-100 transition font-semibold">📄 Remito</a>
            )}
            <button onClick={() => borrarOrden(o.id)} aria-label="Borrar" className="text-stone-300 hover:text-red-500 px-1 leading-none text-lg">×</button>
          </div>
        </div>
        <div className="space-y-2">
          {[...porLiso.entries()].map(([liso, items]) => (
            <div key={liso}>
              <span className="font-mono text-xs text-stone-500">{liso}</span>
              <div className="ml-3 mt-1 space-y-1">
                {items.map((it) => {
                  const pend = it.cantidad - it.confirmado;
                  const completo = pend <= 0;
                  return (
                  <div key={it.id} className="flex items-center gap-2 text-sm">
                    <span className="text-stone-700 flex-1 truncate">{it.gnNombre || `Producto ${it.gnId}`} · <strong>{it.talle}</strong></span>
                    <span className="text-xs text-stone-400">pedido {it.cantidad}</span>
                    <span className="text-xs text-stone-500">{esProd ? 'producidas' : 'estampadas'} <strong className="text-stone-700">{it.confirmado}</strong></span>
                    {!completo && o.estado !== 'hecha' && <span className="text-xs text-stone-400">+</span>}
                    <NumInput value={parseInt(confirmEdit[it.id] ?? '') || 0} min="0"
                      onChange={(n) => setConfirmEdit((p) => ({ ...p, [it.id]: String(Math.max(0, Math.min(n, it.cantidad - it.confirmado))) }))}
                      disabled={o.estado === 'hecha' || completo} className={`w-14 text-right ${inp}`} />
                    <span className={`text-xs font-semibold w-20 text-right ${completo ? 'text-emerald-600' : 'text-amber-600'}`}>{completo ? 'completo ✓' : `pend. ${pend}`}</span>
                  </div>
                  );
                })}
              </div>
            </div>
          ))}
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
