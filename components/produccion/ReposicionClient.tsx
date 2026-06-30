'use client';

import { useState, useEffect, useCallback } from 'react';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toaster';

interface GnProd { gnId: number; code: string | null; name: string; provider: string; category: string | null; skuLiso: string | null; }
interface Fila { talle: string; stockGN: number; minimo: number; aEstampar: number; }
interface PrintRep { gnId: number; nombre: string | null; filas: Fila[]; aEstamparTotal: number; }
interface LisoRep { skuLiso: string; lisoDisp: Record<string, number>; prints: PrintRep[]; aEstamparTotal: number; }
interface Reporte { lisos: LisoRep[]; errores: { gnId: number; error: string }[]; }

const inp = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");

export function ReposicionClient() {
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [loadingRep, setLoadingRep] = useState(false);
  const [repError, setRepError] = useState('');
  const [minimoEdit, setMinimoEdit] = useState<Record<string, string>>({});

  const [verMapeo, setVerMapeo] = useState(false);
  const [productos, setProductos] = useState<GnProd[]>([]);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [lisosSugeridos, setLisosSugeridos] = useState<string[]>([]);
  const [filtro, setFiltro] = useState('');
  const [soloSinVincular, setSoloSinVincular] = useState(false);
  const [asignSku, setAsignSku] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const cargarProductos = useCallback(async () => {
    const r = await fetch('/api/reposicion/productos');
    if (r.ok) {
      const d = await r.json();
      setProductos(d.productos);
      setUltimaSync(d.ultimaSync);
      setAsignSku(Object.fromEntries(d.productos.filter((p: GnProd) => p.skuLiso).map((p: GnProd) => [p.gnId, p.skuLiso])));
    }
  }, []);

  useEffect(() => { cargarProductos(); }, [cargarProductos]);
  useEffect(() => {
    fetch('/api/produccion/stock-terminado').then((r) => r.ok ? r.json() : []).then((rows: { sku: string }[]) => {
      setLisosSugeridos((prev) => [...new Set([...prev, ...rows.map((x) => x.sku)])]);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    setLisosSugeridos((prev) => [...new Set([...prev, ...productos.map((p) => p.skuLiso).filter(Boolean) as string[]])]);
  }, [productos]);

  // --- Reporte ---
  const generarReporte = async () => {
    setLoadingRep(true); setRepError('');
    const r = await fetch('/api/reposicion/reporte');
    if (r.ok) {
      const d: Reporte = await r.json();
      setReporte(d);
      const me: Record<string, string> = {};
      for (const l of d.lisos) for (const p of l.prints) for (const f of p.filas) me[`${p.gnId}|${f.talle}`] = String(f.minimo);
      setMinimoEdit(me);
      if (d.errores.length) toast.error(`${d.errores.length} producto(s) no se pudieron leer de Gestión Nube`);
    } else {
      const d = await r.json().catch(() => ({}));
      setRepError(d.error || 'No se pudo generar el reporte');
    }
    setLoadingRep(false);
  };

  const guardarMinimo = async (gnId: number, talle: string) => {
    const minimo = parseInt(minimoEdit[`${gnId}|${talle}`]) || 0;
    const r = await fetch('/api/reposicion/minimo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gnId, talle, minimo }),
    });
    if (r.ok) {
      setReporte((prev) => {
        if (!prev) return prev;
        return { ...prev, lisos: prev.lisos.map((l) => ({
          ...l,
          prints: l.prints.map((p) => p.gnId !== gnId ? p : {
            ...p,
            filas: p.filas.map((f) => f.talle !== talle ? f : { ...f, minimo, aEstampar: Math.max(0, minimo - f.stockGN) }),
            aEstamparTotal: p.filas.reduce((s, f) => s + (f.talle === talle ? Math.max(0, minimo - f.stockGN) : f.aEstampar), 0),
          }),
        })).map((l) => ({ ...l, aEstamparTotal: l.prints.reduce((s, p) => s + p.aEstamparTotal, 0) })) };
      });
    } else toast.error('No se pudo guardar el mínimo');
  };

  // --- Sincronizar catálogo desde Gestión Nube ---
  const sincronizar = async (reiniciar = false) => {
    setSyncing(true); setSyncMsg('Sincronizando con Gestión Nube…');
    for (let i = 0; i < 80; i++) {
      const r = await fetch('/api/reposicion/sync-productos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(i === 0 ? { reiniciar } : {}),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.error || 'Error al sincronizar'); break; }
      await cargarProductos();
      if (d.done) { setSyncMsg(''); toast.success('Catálogo sincronizado'); break; }
      const totalPag = d.total ? Math.ceil(d.total / 50) : '?';
      setSyncMsg(`Sincronizando… página ${d.lastPage}/${totalPag}${d.error ? ' · la API de GN se saturó, reintentando' : ''}`);
      if (d.error) await new Promise((s) => setTimeout(s, 2500)); // backoff si saturó
    }
    setSyncing(false);
  };

  const vincular = async (p: GnProd) => {
    const skuLiso = (asignSku[p.gnId] || '').trim();
    if (!skuLiso) { toast.error('Elegí el SKU del liso'); return; }
    const r = await fetch('/api/reposicion/mapeo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gnId: p.gnId, gnCode: p.code, gnNombre: p.name, skuLiso }),
    });
    if (r.ok) {
      setProductos((prev) => prev.map((x) => x.gnId === p.gnId ? { ...x, skuLiso: skuLiso.toUpperCase() } : x));
      toast.success(`${p.name} → ${skuLiso.toUpperCase()}`);
    } else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'Error al vincular'); }
  };

  const desvincular = async (p: GnProd) => {
    const r = await fetch(`/api/reposicion/mapeo?gnId=${p.gnId}`, { method: 'DELETE' });
    if (r.ok) {
      setProductos((prev) => prev.map((x) => x.gnId === p.gnId ? { ...x, skuLiso: null } : x));
      setAsignSku((s) => ({ ...s, [p.gnId]: '' }));
    } else toast.error('No se pudo desvincular');
  };

  const vinculados = productos.filter((p) => p.skuLiso).length;
  const f = norm(filtro.trim());
  const lista = productos.filter((p) => {
    if (soloSinVincular && p.skuLiso) return false;
    if (!f) return true;
    return norm(`${p.code ?? ''} ${p.name} ${p.provider}`).includes(f);
  });

  return (
    <div className="space-y-6">
      {/* Reporte */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h3 className="text-sm font-bold text-stone-800">Reporte de reposición</h3>
          <Button variant="primary" size="sm" onClick={generarReporte} isLoading={loadingRep} disabled={vinculados === 0}>
            {reporte ? 'Actualizar' : 'Generar reporte'}
          </Button>
        </div>
        <p className="text-xs text-stone-400 mb-4">
          Cruza el stock de Gestión Nube (productos propios vinculados, Local + Depósito) + tus lisos en areben contra el mínimo.
          {vinculados === 0 && ' Primero vinculá productos abajo.'}
        </p>
        {repError && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-3">{repError}</div>}
        {loadingRep && <p className="text-xs text-amber-600 mb-3">Consultando Gestión Nube… puede tardar (su API es lenta).</p>}
        {reporte && reporte.errores.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800 mb-3">
            {reporte.errores.length} producto(s) no se pudieron leer de Gestión Nube. El total puede estar incompleto.
          </div>
        )}
        {reporte && reporte.lisos.length === 0 && !loadingRep && <p className="text-sm text-stone-400">Sin productos vinculados todavía.</p>}
        <div className="space-y-5">
          {reporte?.lisos.map((l) => {
            const tallesLiso = Object.keys(l.lisoDisp).sort();
            return (
              <div key={l.skuLiso} className={`rounded-xl border p-4 ${l.aEstamparTotal > 0 ? 'border-amber-300 bg-amber-50/30' : 'border-stone-200'}`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono font-bold text-sm text-stone-800">{l.skuLiso}</span>
                  {l.aEstamparTotal > 0
                    ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">A estampar: {l.aEstamparTotal}</span>
                    : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">OK</span>}
                </div>
                <p className="text-xs text-stone-400 mb-3">
                  Liso disponible: {tallesLiso.length ? tallesLiso.map((t) => `${t} ${l.lisoDisp[t]}`).join(' · ') : 'sin stock de liso'}
                </p>

                <div className="space-y-3">
                  {l.prints.map((pr) => (
                    <div key={pr.gnId} className="border border-stone-100 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-sm font-medium text-stone-700 truncate">{pr.nombre || `Producto ${pr.gnId}`}</span>
                        {pr.aEstamparTotal > 0 && <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">estampar {pr.aEstamparTotal}</span>}
                      </div>
                      <div className="overflow-x-auto"><table className="w-full text-sm">
                        <thead><tr className="text-xs text-stone-400 uppercase tracking-widest border-b border-stone-100">
                          <th className="text-left py-1">Talle</th><th className="text-right py-1">Stock venta</th><th className="text-right py-1">Mínimo</th><th className="text-right py-1">A estampar</th>
                        </tr></thead>
                        <tbody>
                          {pr.filas.map((fi) => (
                            <tr key={fi.talle} className="border-b border-stone-50">
                              <td className="py-1 font-semibold text-stone-700">{fi.talle}</td>
                              <td className="text-right tabular-nums text-stone-600">{fi.stockGN}</td>
                              <td className="text-right">
                                <NumInput value={parseFloat(minimoEdit[`${pr.gnId}|${fi.talle}`]) || 0}
                                  onChange={(n) => setMinimoEdit((p) => ({ ...p, [`${pr.gnId}|${fi.talle}`]: n ? String(n) : '' }))}
                                  onBlur={() => guardarMinimo(pr.gnId, fi.talle)} min="0" className={`w-16 text-right ${inp}`} />
                              </td>
                              <td className={`text-right tabular-nums font-bold ${fi.aEstampar > 0 ? 'text-amber-700' : 'text-stone-300'}`}>{fi.aEstampar}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table></div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Vincular (lista) */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <button onClick={() => setVerMapeo((o) => !o)} className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-stone-50 transition">
          <span className="text-sm font-bold text-stone-800">Vincular productos (Gestión Nube → liso) · {vinculados}/{productos.length}</span>
          <span className="text-stone-400 text-sm">{verMapeo ? '▲' : '▼'}</span>
        </button>
        {verMapeo && (
          <div className="border-t border-stone-100 p-6 space-y-4">
            <datalist id="lisos-sug">{lisosSugeridos.map((s) => <option key={s} value={s} />)}</datalist>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => sincronizar()} isLoading={syncing}>
                {productos.length === 0 ? 'Sincronizar productos' : 'Actualizar lista'}
              </Button>
              <span className="text-xs text-stone-400">
                {syncMsg || (ultimaSync ? `Última sync: ${new Date(ultimaSync).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Todavía no sincronizaste el catálogo')}
              </span>
            </div>

            {productos.length === 0 ? (
              <p className="text-sm text-stone-400">Apretá "Sincronizar productos" para traer tus artículos de Gestión Nube (Zattia/Areben) y vincularlos. Se hace una vez (después solo actualizás).</p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <input type="text" value={filtro} onChange={(e) => setFiltro(e.target.value)}
                    placeholder="Filtrar por nombre / código / marca…" className={`${inp} flex-1`} />
                  <label className="flex items-center gap-1.5 text-xs text-stone-500 whitespace-nowrap">
                    <input type="checkbox" checked={soloSinVincular} onChange={(e) => setSoloSinVincular(e.target.checked)} className="rounded border-stone-300 accent-amber-500" />
                    Solo sin vincular
                  </label>
                </div>

                <div className="space-y-1.5 max-h-[28rem] overflow-y-auto">
                  {lista.length === 0 ? <p className="text-xs text-stone-400 py-2">Sin resultados.</p> : lista.map((p) => (
                    <div key={p.gnId} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${p.skuLiso ? 'border-emerald-200 bg-emerald-50/40' : 'border-stone-100'}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-stone-800 truncate">{p.name}</p>
                        <p className="text-xs text-stone-400">{p.provider}{p.category ? ` · ${p.category}` : ''}</p>
                      </div>
                      <input type="text" list="lisos-sug" value={asignSku[p.gnId] || ''} placeholder="SKU liso"
                        onChange={(e) => setAsignSku((s) => ({ ...s, [p.gnId]: e.target.value.toUpperCase() }))}
                        className={`${inp} font-mono w-44`} />
                      <button onClick={() => vincular(p)} className="text-xs px-3 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 font-semibold transition">
                        {p.skuLiso ? 'Guardar' : 'Vincular'}
                      </button>
                      {p.skuLiso && (
                        <button onClick={() => desvincular(p)} title="Desvincular" className="text-stone-300 hover:text-red-500 px-1 leading-none text-lg">×</button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
