'use client';

import { useState, useEffect, useCallback } from 'react';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toaster';

interface Mapeo { id: string; gnCode: string; gnNombre: string | null; skuLiso: string; }
interface GnProd { id: number; code: string; name: string; provider: string; category: string; }
interface Fila { talle: string; stockGN: number; stockAreben: number; total: number; minimo: number; aProducir: number; }
interface LisoRep { skuLiso: string; codigos: { gnCode: string; gnNombre: string | null }[]; filas: Fila[]; aProducirTotal: number; }
interface Reporte { lisos: LisoRep[]; errores: { gnCode: string; error: string }[]; }

const inp = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';

export function ReposicionClient() {
  const [mapeos, setMapeos] = useState<Mapeo[]>([]);
  const [lisosSugeridos, setLisosSugeridos] = useState<string[]>([]);
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [loadingRep, setLoadingRep] = useState(false);
  const [repError, setRepError] = useState('');
  const [verMapeo, setVerMapeo] = useState(false);
  // búsqueda GN
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<GnProd[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [asignSku, setAsignSku] = useState<Record<string, string>>({});
  // edición de mínimos (local): clave `${liso}|${talle}`
  const [minimoEdit, setMinimoEdit] = useState<Record<string, string>>({});

  const cargarMapeos = useCallback(async () => {
    const r = await fetch('/api/reposicion/mapeo');
    if (r.ok) setMapeos(await r.json());
  }, []);

  useEffect(() => { cargarMapeos(); }, [cargarMapeos]);
  useEffect(() => {
    // SKUs de liso para sugerir (stock terminado + ya mapeados)
    fetch('/api/produccion/stock-terminado').then((r) => r.ok ? r.json() : []).then((rows: { sku: string }[]) => {
      setLisosSugeridos((prev) => [...new Set([...prev, ...rows.map((x) => x.sku)])]);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    setLisosSugeridos((prev) => [...new Set([...prev, ...mapeos.map((m) => m.skuLiso)])]);
  }, [mapeos]);

  const generarReporte = async () => {
    setLoadingRep(true); setRepError('');
    const r = await fetch('/api/reposicion/reporte');
    if (r.ok) {
      const d: Reporte = await r.json();
      setReporte(d);
      const me: Record<string, string> = {};
      for (const l of d.lisos) for (const f of l.filas) me[`${l.skuLiso}|${f.talle}`] = String(f.minimo);
      setMinimoEdit(me);
      if (d.errores.length) toast.error(`${d.errores.length} producto(s) no se pudieron leer de Gestión Nube`);
    } else {
      const d = await r.json().catch(() => ({}));
      setRepError(d.error || 'No se pudo generar el reporte');
    }
    setLoadingRep(false);
  };

  const guardarMinimo = async (skuLiso: string, talle: string) => {
    const key = `${skuLiso}|${talle}`;
    const minimo = parseInt(minimoEdit[key]) || 0;
    const r = await fetch('/api/reposicion/minimo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skuLiso, talle, minimo }),
    });
    if (r.ok) {
      // recalcular a producir local
      setReporte((prev) => prev && ({ ...prev, lisos: prev.lisos.map((l) => l.skuLiso !== skuLiso ? l : {
        ...l,
        filas: l.filas.map((f) => f.talle !== talle ? f : { ...f, minimo, aProducir: Math.max(0, minimo - f.total) }),
        aProducirTotal: l.filas.reduce((s, f) => s + (f.talle === talle ? Math.max(0, minimo - f.total) : f.aProducir), 0),
      }) }));
    } else toast.error('No se pudo guardar el mínimo');
  };

  const buscarGN = async () => {
    if (q.trim().length < 2) { toast.error('Escribí al menos 2 letras'); return; }
    setBuscando(true);
    const r = await fetch(`/api/reposicion/buscar-gn?q=${encodeURIComponent(q.trim())}`);
    if (r.ok) setResultados(await r.json());
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'Error al buscar en Gestión Nube'); }
    setBuscando(false);
  };

  const vincular = async (p: GnProd) => {
    const skuLiso = (asignSku[p.code] || '').trim();
    if (!skuLiso) { toast.error('Elegí el SKU del liso'); return; }
    const r = await fetch('/api/reposicion/mapeo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gnCode: p.code, gnNombre: p.name, skuLiso }),
    });
    if (r.ok) { toast.success(`${p.code} → ${skuLiso.toUpperCase()}`); cargarMapeos(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'Error al vincular'); }
  };

  const borrarMapeo = async (id: string) => {
    const r = await fetch(`/api/reposicion/mapeo?id=${id}`, { method: 'DELETE' });
    if (r.ok) cargarMapeos(); else toast.error('No se pudo borrar');
  };

  const mapeadosCount = mapeos.length;

  return (
    <div className="space-y-6">
      {/* Reporte */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h3 className="text-sm font-bold text-stone-800">Reporte de reposición</h3>
          <Button variant="primary" size="sm" onClick={generarReporte} isLoading={loadingRep} disabled={mapeadosCount === 0}>
            {reporte ? 'Actualizar' : 'Generar reporte'}
          </Button>
        </div>
        <p className="text-xs text-stone-400 mb-4">
          Cruza el stock de Gestión Nube (productos propios mapeados, Local + Depósito) + tus lisos en areben contra el mínimo.
          {mapeadosCount === 0 && ' Primero vinculá productos abajo.'}
        </p>

        {repError && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-3">{repError}</div>}
        {loadingRep && <p className="text-xs text-amber-600 mb-3">Consultando Gestión Nube… puede tardar (su API es lenta).</p>}

        {reporte && reporte.errores.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800 mb-3">
            {reporte.errores.length} producto(s) no se pudieron leer de Gestión Nube (API inestable). El total puede estar incompleto.
          </div>
        )}

        {reporte && reporte.lisos.length === 0 && !loadingRep && (
          <p className="text-sm text-stone-400">Sin lisos mapeados todavía.</p>
        )}

        <div className="space-y-4">
          {reporte?.lisos.map((l) => (
            <div key={l.skuLiso} className={`rounded-xl border p-4 ${l.aProducirTotal > 0 ? 'border-amber-300 bg-amber-50/40' : 'border-stone-200'}`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-mono font-bold text-sm text-stone-800">{l.skuLiso}</span>
                {l.aProducirTotal > 0
                  ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">A producir: {l.aProducirTotal}</span>
                  : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">OK</span>}
              </div>
              <p className="text-xs text-stone-400 mb-2">{l.codigos.length} producto(s) GN: {l.codigos.map((c) => c.gnCode).join(', ')}</p>
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="text-xs text-stone-400 uppercase tracking-widest border-b border-stone-100">
                  <th className="text-left py-1.5">Talle</th>
                  <th className="text-right py-1.5">Stock GN</th>
                  <th className="text-right py-1.5">Lisos areben</th>
                  <th className="text-right py-1.5">Total</th>
                  <th className="text-right py-1.5">Mínimo</th>
                  <th className="text-right py-1.5">A producir</th>
                </tr></thead>
                <tbody>
                  {l.filas.map((f) => (
                    <tr key={f.talle} className="border-b border-stone-50">
                      <td className="py-1.5 font-semibold text-stone-700">{f.talle}</td>
                      <td className="text-right tabular-nums text-stone-600">{f.stockGN}</td>
                      <td className="text-right tabular-nums text-stone-600">{f.stockAreben}</td>
                      <td className="text-right tabular-nums font-semibold text-stone-800">{f.total}</td>
                      <td className="text-right">
                        <NumInput value={parseFloat(minimoEdit[`${l.skuLiso}|${f.talle}`]) || 0}
                          onChange={(n) => setMinimoEdit((p) => ({ ...p, [`${l.skuLiso}|${f.talle}`]: n ? String(n) : '' }))}
                          onBlur={() => guardarMinimo(l.skuLiso, f.talle)}
                          min="0" className={`w-20 text-right ${inp}`} />
                      </td>
                      <td className={`text-right tabular-nums font-bold ${f.aProducir > 0 ? 'text-amber-700' : 'text-stone-300'}`}>{f.aProducir}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          ))}
        </div>
      </div>

      {/* Mapeo */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <button onClick={() => setVerMapeo((o) => !o)} className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-stone-50 transition">
          <span className="text-sm font-bold text-stone-800">Vincular productos (Gestión Nube → liso) · {mapeadosCount}</span>
          <span className="text-stone-400 text-sm">{verMapeo ? '▲' : '▼'}</span>
        </button>
        {verMapeo && (
          <div className="border-t border-stone-100 p-6 space-y-5">
            <datalist id="lisos-sug">{lisosSugeridos.map((s) => <option key={s} value={s} />)}</datalist>

            {/* Buscar en GN */}
            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Buscar producto en Gestión Nube (nombre o código)</label>
              <div className="flex gap-2">
                <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') buscarGN(); }}
                  placeholder="Ej: remera boxy negra" className={`${inp} flex-1`} />
                <Button variant="secondary" size="sm" onClick={buscarGN} isLoading={buscando}>Buscar</Button>
              </div>
              <div className="mt-3 space-y-2">
                {resultados.map((p) => (
                  <div key={p.code} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-800 truncate"><span className="font-mono text-xs text-stone-500">{p.code}</span> · {p.name}</p>
                      <p className="text-xs text-stone-400">{p.provider} · {p.category}</p>
                    </div>
                    <input type="text" list="lisos-sug" value={asignSku[p.code] || ''} placeholder="SKU liso"
                      onChange={(e) => setAsignSku((s) => ({ ...s, [p.code]: e.target.value.toUpperCase() }))}
                      className={`${inp} font-mono w-44`} />
                    <button onClick={() => vincular(p)} className="text-xs px-3 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 font-semibold transition">Vincular</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Mapeos existentes */}
            <div>
              <p className="text-xs font-semibold text-stone-600 mb-2">Vínculos actuales</p>
              {mapeos.length === 0 ? (
                <p className="text-xs text-stone-400">Sin vínculos todavía.</p>
              ) : (
                <div className="space-y-1.5">
                  {mapeos.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-stone-50">
                      <span className="font-mono text-xs text-stone-500 w-20">{m.gnCode}</span>
                      <span className="text-stone-600 flex-1 truncate">{m.gnNombre || '—'}</span>
                      <span className="text-stone-400">→</span>
                      <span className="font-mono text-xs font-semibold text-stone-700">{m.skuLiso}</span>
                      <button onClick={() => borrarMapeo(m.id)} aria-label="Quitar" className="text-stone-300 hover:text-red-500 px-1 leading-none">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
