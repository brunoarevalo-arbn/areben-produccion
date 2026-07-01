'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toaster';

interface Ventas { v7: number; v30: number; v90: number; }
interface Fila { talle: string; stockGN: number; minimo: number; esDefault: boolean; ventas: Ventas; aEstampar: number; }
interface PrintRep { gnId: number; nombre: string | null; filas: Fila[]; aEstamparTotal: number; }
interface Grupo { skuLiso: string; lisoDisp: Record<string, number>; prints: PrintRep[]; aEstamparTotal: number; }
interface Reporte { lisos: Grupo[]; produccion: Grupo[]; stockAt: string | null; ventasAt: string | null; minimoDefault: number; }

type Modo = '' | 'estampa' | 'produccion';
const inp = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';
// Etiquetas por modalidad.
const VERBO = { estampa: 'estampar', produccion: 'producir' } as const;
const ACCION = { estampa: '✂ Generar orden de estampa', produccion: '🧵 Generar orden de producción' } as const;

export function QueEstamparClient() {
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [cargando, setCargando] = useState(true);
  const [actualizandoStock, setActualizandoStock] = useState(false);
  const [actualizandoVentas, setActualizandoVentas] = useState(false);
  const [minDefault, setMinDefault] = useState('1');
  const [minimoEdit, setMinimoEdit] = useState<Record<string, string>>({});
  const [modo, setModo] = useState<Modo>('');
  const [estamparEdit, setEstamparEdit] = useState<Record<string, string>>({});
  const [generando, setGenerando] = useState(false);
  const [soloFaltantes, setSoloFaltantes] = useState(false);

  const cargar = useCallback(async () => {
    const r = await fetch('/api/reposicion/reporte');
    if (r.ok) {
      const d: Reporte = await r.json();
      setReporte(d);
      setMinDefault(String(d.minimoDefault));
      const me: Record<string, string> = {};
      for (const g of [...d.lisos, ...d.produccion]) for (const p of g.prints) for (const f of p.filas) if (!f.esDefault) me[`${p.gnId}|${f.talle}`] = String(f.minimo);
      setMinimoEdit(me);
    }
    setCargando(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]); // auto-carga al entrar (lee la copia local)

  const actualizarStock = async () => {
    setActualizandoStock(true);
    const r = await fetch('/api/reposicion/sync-stock', { method: 'POST' });
    if (r.ok) { const d = await r.json(); toast.success(`Stock actualizado (${d.productos} productos${d.errores ? `, ${d.errores} con error` : ''})`); await cargar(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo actualizar el stock'); }
    setActualizandoStock(false);
  };

  const actualizarVentas = async () => {
    setActualizandoVentas(true);
    const r = await fetch('/api/reposicion/sync-ventas', { method: 'POST' });
    if (r.ok) { const d = await r.json(); toast.success(`Ventas actualizadas (${d.ventas} ventas leídas)${d.error ? ' · la API se saturó, quedó parcial' : ''}`); await cargar(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudieron actualizar las ventas'); }
    setActualizandoVentas(false);
  };

  const guardarDefault = async () => {
    const n = parseInt(minDefault) || 0;
    const r = await fetch('/api/reposicion/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minimoDefault: n }) });
    if (r.ok) cargar(); else toast.error('No se pudo guardar el mínimo por defecto');
  };

  const guardarMinimo = async (gnId: number, talle: string) => {
    const raw = minimoEdit[`${gnId}|${talle}`];
    const def = parseInt(minDefault) || 0;
    const esVacio = raw == null || raw.trim() === '';
    const minimo = esVacio ? def : (parseInt(raw) || 0);
    const r = esVacio
      ? await fetch(`/api/reposicion/minimo?gnId=${gnId}&talle=${encodeURIComponent(talle)}`, { method: 'DELETE' })
      : await fetch('/api/reposicion/minimo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gnId, talle, minimo }) });
    if (r.ok) {
      const aplicar = (grupos: Grupo[]) => grupos.map((g) => {
        const prints = g.prints.map((p) => p.gnId !== gnId ? p : {
          ...p,
          filas: p.filas.map((f) => f.talle !== talle ? f : { ...f, minimo, esDefault: esVacio, aEstampar: Math.max(0, minimo - f.stockGN) }),
        });
        return { ...g, prints, aEstamparTotal: prints.reduce((s, p) => s + p.filas.reduce((fs, f) => fs + f.aEstampar, 0), 0) };
      });
      setReporte((prev) => prev && ({ ...prev, lisos: aplicar(prev.lisos), produccion: aplicar(prev.produccion) }));
    } else toast.error('No se pudo guardar el mínimo');
  };

  const gruposDe = (tipo: Modo): Grupo[] => !reporte ? [] : tipo === 'produccion' ? reporte.produccion : reporte.lisos;

  const iniciarOrden = (tipo: 'estampa' | 'produccion') => {
    const ee: Record<string, string> = {};
    for (const g of gruposDe(tipo)) for (const p of g.prints) for (const f of p.filas) ee[`${p.gnId}|${f.talle}`] = f.aEstampar > 0 ? String(f.aEstampar) : '';
    setEstamparEdit(ee);
    setModo(tipo);
  };

  const generarOrden = async () => {
    if (modo === '') return;
    const items: { gnId: number; gnNombre: string | null; skuLiso: string; talle: string; cantidad: number }[] = [];
    for (const g of gruposDe(modo)) for (const p of g.prints) for (const f of p.filas) {
      const cantidad = parseInt(estamparEdit[`${p.gnId}|${f.talle}`]) || 0;
      if (cantidad > 0) items.push({ gnId: p.gnId, gnNombre: p.nombre, skuLiso: g.skuLiso, talle: f.talle, cantidad });
    }
    if (items.length === 0) { toast.error(`No hay nada para ${VERBO[modo]} (cargá cantidades)`); return; }
    setGenerando(true);
    const r = await fetch('/api/reposicion/orden-estampa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: modo, items }) });
    if (r.ok) {
      toast.success(`Orden generada (${items.reduce((s, i) => s + i.cantidad, 0)} prendas) — vela en Órdenes de estampa`);
      setModo(''); setEstamparEdit({}); await cargar();
    } else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo generar la orden'); }
    setGenerando(false);
  };

  const totalActual = modo === '' ? 0 : gruposDe(modo).reduce((s, g) => s + g.prints.reduce((ps, p) => ps + p.filas.reduce((fs, f) => fs + (parseInt(estamparEdit[`${p.gnId}|${f.talle}`]) || 0), 0), 0), 0);

  // Card de un producto-grupo (liso o SKU a producir).
  const renderGrupo = (g: Grupo, tipo: 'estampa' | 'produccion', conLiso: boolean) => {
    const enModo = modo === tipo;
    const tallesLiso = Object.keys(g.lisoDisp).sort();
    return (
      <div key={g.skuLiso} className={`bg-white rounded-2xl border p-4 ${g.aEstamparTotal > 0 ? 'border-amber-300' : 'border-stone-200'}`}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-mono font-bold text-sm text-stone-800">{g.skuLiso}</span>
          {enModo
            ? (g.aEstamparTotal > 0
                ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">A {VERBO[tipo]}: {g.aEstamparTotal}</span>
                : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">OK</span>)
            : (g.aEstamparTotal > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700" title="Está por debajo del mínimo en algún talle">⚠ reponer</span>)}
        </div>
        {conLiso && <p className="text-xs text-stone-400 mb-3">Liso disponible: {tallesLiso.length ? tallesLiso.map((t) => `${t} ${g.lisoDisp[t]}`).join(' · ') : 'sin stock de liso'}</p>}
        <div className={`space-y-3 ${conLiso ? '' : 'mt-2'}`}>
          {g.prints.map((pr) => (
            <div key={pr.gnId} className="border border-stone-100 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-sm font-medium text-stone-700 truncate">{pr.nombre || `Producto ${pr.gnId}`}</span>
                {enModo && pr.aEstamparTotal > 0 && <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">{VERBO[tipo]} {pr.aEstamparTotal}</span>}
              </div>
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="text-xs text-stone-400 uppercase tracking-widest border-b border-stone-100">
                  <th className="text-left py-1">Talle</th>
                  <th className="text-right py-1">7d</th>
                  <th className="text-right py-1">30d</th>
                  <th className="text-right py-1">90d</th>
                  <th className="text-right py-1">Stock</th>
                  {enModo && <th className="text-right py-1">Mínimo</th>}
                  {enModo && <th className="text-right py-1">A {VERBO[tipo]}</th>}
                </tr></thead>
                <tbody>
                  {pr.filas.map((fi) => (
                    <tr key={fi.talle} className="border-b border-stone-50">
                      <td className="py-1 font-semibold text-stone-700">{fi.talle}</td>
                      <td className="text-right tabular-nums text-stone-500">{fi.ventas.v7}</td>
                      <td className="text-right tabular-nums text-stone-500">{fi.ventas.v30}</td>
                      <td className="text-right tabular-nums text-stone-500">{fi.ventas.v90}</td>
                      <td className="text-right tabular-nums font-semibold text-stone-700">{fi.stockGN}</td>
                      {enModo && (
                        <td className="text-right">
                          <NumInput value={parseFloat(minimoEdit[`${pr.gnId}|${fi.talle}`]) || 0}
                            onChange={(n) => setMinimoEdit((p) => ({ ...p, [`${pr.gnId}|${fi.talle}`]: n ? String(n) : '' }))}
                            onBlur={() => guardarMinimo(pr.gnId, fi.talle)} min="0" placeholder={minDefault}
                            className={`w-16 text-right ${inp} ${fi.esDefault ? 'text-stone-400' : ''}`} />
                        </td>
                      )}
                      {enModo && (
                        <td className="text-right">
                          <NumInput value={parseFloat(estamparEdit[`${pr.gnId}|${fi.talle}`]) || 0}
                            onChange={(n) => setEstamparEdit((p) => ({ ...p, [`${pr.gnId}|${fi.talle}`]: n ? String(n) : '' }))}
                            min="0" placeholder="0" className={`w-16 text-right font-bold ${inp} ${(parseInt(estamparEdit[`${pr.gnId}|${fi.talle}`]) || 0) > 0 ? 'text-amber-700' : 'text-stone-400'}`} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Encabezado de sección con su botón "Generar orden" (solo cuando no hay otro modo activo).
  const renderSeccion = (titulo: string, sub: string, grupos: Grupo[], tipo: 'estampa' | 'produccion', conLiso: boolean) => {
    const visibles = grupos.filter((g) => !soloFaltantes || g.aEstamparTotal > 0);
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-bold text-stone-800">{titulo} <span className="text-stone-400 font-normal">· {grupos.length}</span></h2>
            <p className="text-xs text-stone-400">{sub}</p>
          </div>
          {modo === '' && grupos.length > 0 && (
            <Button variant="primary" size="sm" onClick={() => iniciarOrden(tipo)}>{ACCION[tipo]}</Button>
          )}
          {modo === tipo && <span className="text-xs font-semibold text-amber-700">Cargá las cantidades a {VERBO[tipo]} ↓</span>}
        </div>
        {grupos.length === 0
          ? <p className="text-xs text-stone-400">{tipo === 'produccion' ? 'No hay productos de producción directa. Asocialos en Vinculación (modalidad “Producción directa”).' : 'No hay productos de estampa vinculados.'}</p>
          : visibles.length === 0
            ? <p className="text-xs text-stone-400">Nada por debajo del mínimo.</p>
            : visibles.map((g) => renderGrupo(g, tipo, conLiso))}
      </section>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Barra de control */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Button variant="secondary" size="sm" onClick={actualizarStock} isLoading={actualizandoStock}>↻ Actualizar stock</Button>
        <Button variant="secondary" size="sm" onClick={actualizarVentas} isLoading={actualizandoVentas}>↻ Actualizar ventas</Button>
        <span className="text-xs text-stone-400">
          {reporte?.stockAt
            ? `Stock al ${new Date(reporte.stockAt).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
            : 'Sin stock cargado'}
          {reporte?.ventasAt && ` · Ventas al ${new Date(reporte.ventasAt).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
        </span>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-stone-500">
          <input type="checkbox" checked={soloFaltantes} onChange={(e) => setSoloFaltantes(e.target.checked)} className="rounded border-stone-300 accent-amber-500" />
          Solo lo que falta reponer
        </label>
      </div>

      {cargando ? (
        <p className="text-sm text-stone-400">Cargando…</p>
      ) : !reporte || (reporte.lisos.length === 0 && reporte.produccion.length === 0) ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-sm text-stone-400">
          No hay productos vinculados. Andá a <Link href="/reposicion/vincular" className="text-amber-600 font-semibold">Vinculación</Link> para asociar tus productos de Gestión Nube.
        </div>
      ) : (
        <>
          {renderSeccion('Estampados', 'Tenés liso de buffer → reponés estampando', reporte.lisos, 'estampa', true)}
          {renderSeccion('Producción directa', 'Sin stock intermedio → reponés produciendo', reporte.produccion, 'produccion', false)}

          {modo !== '' && (
            <div className="flex items-center justify-between gap-3 flex-wrap fixed bottom-0 inset-x-0 md:left-56 bg-stone-50/95 border-t border-stone-200 p-4 z-20">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-stone-500">A {VERBO[modo]}: <strong className="text-stone-800">{totalActual}</strong></span>
                <label className="flex items-center gap-2 text-stone-500 text-xs">Mínimo por defecto
                  <NumInput value={parseFloat(minDefault) || 0} onChange={(n) => setMinDefault(n ? String(n) : '')} onBlur={guardarDefault} min="0" className={`w-14 text-right ${inp}`} />
                </label>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => { setModo(''); setEstamparEdit({}); }}>Cancelar</Button>
                <Button variant="primary" size="sm" onClick={generarOrden} isLoading={generando} disabled={totalActual === 0}>Confirmar orden de {modo === 'estampa' ? 'estampa' : 'producción'}</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
