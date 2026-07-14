'use client';

import { useState, useEffect, useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { NumInput } from '@/components/ui/NumInput';
import { toast } from '@/components/ui/Toaster';
import { calcularMargen, pvpDesdeMarkup, aplicarDescuento } from '@/lib/costos/precios';

interface Fila {
  gnId: number; code: string | null; nombre: string; marca: string; skuLiso: string; tipo: string;
  costoAuto: number | null; costoManual: number | null; costoNeto: number | null;
  pvpGN: number | null; pvpManual: number | null; pvpEfectivo: number | null;
  pvpSinIva: number | null; markup: number | null; margen: number | null; overrideAt: string | null;
}
interface Config { ivaVenta: number; markupVentaDefault: number; }

const inp = 'px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const fmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const money = (n: number | null | undefined) => (n == null ? '—' : '$' + fmt.format(Math.round(n)));
const pct = (n: number | null | undefined) => (n == null ? '—' : `${n >= 0 ? '' : ''}${(Math.round(n * 10) / 10).toString().replace('.', ',')}%`);

const marcaBadge = (m: string) => {
  const l = m.toLowerCase();
  if (l.includes('zattia')) return 'bg-violet-100 text-violet-700';
  if (l.includes('stunned')) return 'bg-pink-100 text-pink-700';
  return 'bg-stone-100 text-stone-600';
};
const margenColor = (m: number | null) => (m == null ? 'text-stone-400' : m < 40 ? 'text-red-600 font-semibold' : m < 55 ? 'text-amber-600' : 'text-emerald-700');

export function ListaPreciosClient() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [config, setConfig] = useState<Config>({ ivaVenta: 21, markupVentaDefault: 130 });
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [busq, setBusq] = useState('');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [descuento, setDescuento] = useState(0);
  const [editPvp, setEditPvp] = useState<Record<number, number>>({});
  const [editCosto, setEditCosto] = useState<Record<number, number>>({});
  const [exportando, setExportando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/precios');
      if (r.ok) { const d = await r.json(); setFilas(d.filas); setConfig(d.config); }
      else toast.error('No se pudieron cargar los precios');
    } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const iva = config.ivaVenta;

  const marcas = useMemo(() => [...new Set(filas.map((f) => f.marca).filter(Boolean))].sort(), [filas]);

  const visibles = useMemo(() => {
    const q = busq.trim().toLowerCase();
    return filas.filter((f) =>
      (filtro === 'todos' || f.marca.toLowerCase().includes(filtro)) &&
      (!q || f.nombre.toLowerCase().includes(q) || f.skuLiso.toLowerCase().includes(q) || (f.code ?? '').toLowerCase().includes(q)),
    );
  }, [filas, filtro, busq]);

  // ---- Overrides manuales (PVP / costo) ----
  const recalcFila = (f: Fila): Fila => {
    const costoNeto = f.costoManual ?? f.costoAuto;
    const pvpEfectivo = f.pvpManual ?? f.pvpGN;
    const m = calcularMargen(costoNeto, pvpEfectivo, iva);
    return { ...f, costoNeto, pvpEfectivo, pvpSinIva: m.pvpSinIva, markup: m.markup, margen: m.margen };
  };

  const guardarOverride = async (fila: Fila, patch: { pvpManual?: number | null; costoManual?: number | null }) => {
    const r = await fetch(`/api/precios/${fila.gnId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    });
    if (!r.ok) { toast.error('No se pudo guardar'); return; }
    setFilas((prev) => prev.map((f) => (f.gnId === fila.gnId ? recalcFila({ ...f, ...patch, overrideAt: new Date().toISOString() }) : f)));
  };

  const onBlurOverride = (
    fila: Fila, campo: 'pvpManual' | 'costoManual',
    editMap: Record<number, number>, setEditMap: Dispatch<SetStateAction<Record<number, number>>>,
  ) => {
    const v = editMap[fila.gnId];
    setEditMap((p) => { const n = { ...p }; delete n[fila.gnId]; return n; });
    if (v === undefined) return;
    const nuevo = v > 0 ? v : null;
    const actual = fila[campo] ?? null;
    if (nuevo === actual) return;                        // sin cambio real
    guardarOverride(fila, { [campo]: nuevo });
  };

  // ---- Selección ----
  const toggle = (gnId: number) => setSel((p) => { const n = new Set(p); n.has(gnId) ? n.delete(gnId) : n.add(gnId); return n; });
  const idsVisibles = visibles.map((f) => f.gnId);
  const allSel = idsVisibles.length > 0 && idsVisibles.every((id) => sel.has(id));
  const toggleAll = () => setSel((p) => {
    const n = new Set(p);
    if (allSel) idsVisibles.forEach((id) => n.delete(id)); else idsVisibles.forEach((id) => n.add(id));
    return n;
  });

  // ---- Totales de la vista ----
  const totales = useMemo(() => {
    const costo = visibles.reduce((s, f) => s + (f.costoNeto ?? 0), 0);
    const pvp = visibles.reduce((s, f) => s + (f.pvpEfectivo ?? 0), 0);
    const conMargen = visibles.filter((f) => f.margen != null);
    const margenProm = conMargen.length ? conMargen.reduce((s, f) => s + (f.margen ?? 0), 0) / conMargen.length : null;
    return { costo, pvp, margenProm, n: visibles.length };
  }, [visibles]);

  // ---- Export ----
  const exportar = () => {
    setExportando(true);
    const p = new URLSearchParams();
    if (descuento > 0) p.set('descuento', String(descuento));
    if (filtro !== 'todos') p.set('marca', filtro);
    if (sel.size > 0) p.set('ids', [...sel].join(','));
    p.set('fecha', new Date().toISOString().slice(0, 10));
    const a = document.createElement('a');
    a.href = `/api/precios/export?${p.toString()}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => setExportando(false), 800);
  };

  if (cargando) return <LoadingState />;
  if (filas.length === 0) return (
    <div className="space-y-6"><Simulador config={config} filas={filas} /><EmptyState title="Sin productos vinculados" message="Vinculá productos de producción propia en Reposición → Vincular productos y sincronizá el catálogo de Gestión Nube." /></div>
  );

  const nSel = sel.size;

  return (
    <div className="space-y-6">
      <Simulador config={config} filas={filas} />

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-stone-100 rounded-xl p-1">
          {['todos', ...marcas.map((m) => m.toLowerCase())].map((m) => (
            <button key={m} onClick={() => setFiltro(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${filtro === m ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}>
              {m}
            </button>
          ))}
        </div>
        <input value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Buscar por nombre / SKU…" className={`${inp} flex-1 min-w-[12rem]`} />
      </div>

      {/* Barra de descuento masivo + export */}
      <Card padding="none" className="p-4 flex flex-wrap items-end gap-4 bg-stone-50">
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1 block">Descuento masivo %</label>
          <NumInput value={descuento} onChange={setDescuento} min="0" max="100" placeholder="0" className={`${inp} w-28`} />
        </div>
        <p className="text-xs text-stone-500 flex-1 min-w-[10rem]">
          {descuento > 0
            ? <>Se aplica {pct(descuento)} sobre el PVP de {nSel > 0 ? `${nSel} seleccionado(s)` : 'todos los visibles'}. La lista se exporta con el precio nuevo (no toca Gestión Nube).</>
            : <>Cargá un % para simular una rebaja y exportarla. Sin selección, exporta todos los visibles.</>}
        </p>
        <Button onClick={exportar} isLoading={exportando}>Exportar Excel{nSel > 0 ? ` (${nSel})` : ''}</Button>
      </Card>

      {/* Tabla */}
      <Card padding="none" className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-stone-400 border-b border-stone-100">
              <th className="px-3 py-2 w-8"><input type="checkbox" checked={allSel} onChange={toggleAll} aria-label="Seleccionar todo" /></th>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2">Marca</th>
              <th className="px-3 py-2">SKU liso</th>
              <th className="px-3 py-2 text-right">Costo neto</th>
              <th className="px-3 py-2 text-right">PVP c/IVA</th>
              {descuento > 0 && <th className="px-3 py-2 text-right">PVP c/desc</th>}
              <th className="px-3 py-2 text-right">PVP s/IVA</th>
              <th className="px-3 py-2 text-right">Markup</th>
              <th className="px-3 py-2 text-right">Margen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {visibles.map((f) => {
              const pvpConDesc = descuento > 0 && f.pvpEfectivo != null && (nSel === 0 || sel.has(f.gnId))
                ? aplicarDescuento(f.pvpEfectivo, descuento) : null;
              const valPvp = editPvp[f.gnId] ?? f.pvpEfectivo ?? 0;
              const valCosto = editCosto[f.gnId] ?? f.costoNeto ?? 0;
              return (
                <tr key={f.gnId} className={`hover:bg-stone-50/60 ${sel.has(f.gnId) ? 'bg-amber-50/40' : ''}`}>
                  <td className="px-3 py-2"><input type="checkbox" checked={sel.has(f.gnId)} onChange={() => toggle(f.gnId)} aria-label={`Seleccionar ${f.nombre}`} /></td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-stone-800 leading-tight">{f.nombre}</p>
                    {f.code && <p className="text-[11px] text-stone-400">{f.code}</p>}
                  </td>
                  <td className="px-3 py-2"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${marcaBadge(f.marca)}`}>{f.marca || '—'}</span></td>
                  <td className="px-3 py-2 text-stone-500 font-mono text-xs">{f.skuLiso}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-stone-400 text-xs">$</span>
                      <NumInput value={valCosto} onChange={(n) => setEditCosto((p) => ({ ...p, [f.gnId]: n }))} onBlur={() => onBlurOverride(f, 'costoManual', editCosto, setEditCosto)}
                        placeholder={f.costoAuto == null ? 'a mano' : ''}
                        className="w-24 px-2 py-1 border border-stone-200 rounded-lg text-sm text-right focus:outline-none focus:border-amber-400 tabular-nums" />
                      {f.costoManual != null
                        ? <button onClick={() => guardarOverride(f, { costoManual: null })} title={f.costoAuto != null ? `Manual · volver al del escandallo (${money(f.costoAuto)})` : 'Manual · borrar'} className="text-[9px] font-bold text-amber-600 hover:text-amber-800">man ✕</button>
                        : f.costoAuto == null ? <span className="text-[9px] text-stone-300" title="Sin escandallo para este SKU">—</span> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-stone-400 text-xs">$</span>
                      <NumInput value={valPvp} onChange={(n) => setEditPvp((p) => ({ ...p, [f.gnId]: n }))} onBlur={() => onBlurOverride(f, 'pvpManual', editPvp, setEditPvp)}
                        className="w-24 px-2 py-1 border border-stone-200 rounded-lg text-sm text-right focus:outline-none focus:border-amber-400 tabular-nums" />
                      {f.pvpManual != null
                        ? <button onClick={() => guardarOverride(f, { pvpManual: null })} title={`Manual · volver al de GN (${money(f.pvpGN)})`} className="text-[9px] font-bold text-amber-600 hover:text-amber-800">man ✕</button>
                        : f.pvpGN == null ? <span className="text-[9px] text-stone-300" title="Sin precio en GN">—</span> : null}
                    </div>
                  </td>
                  {descuento > 0 && <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-700">{pvpConDesc == null ? '—' : money(pvpConDesc)}</td>}
                  <td className="px-3 py-2 text-right tabular-nums text-stone-500">{money(f.pvpSinIva)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-stone-600">{pct(f.markup)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${margenColor(f.margen)}`}>{pct(f.margen)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-stone-200 font-semibold text-stone-700 bg-stone-50/60">
              <td className="px-3 py-2" />
              <td className="px-3 py-2" colSpan={3}>{totales.n} producto(s){filtro !== 'todos' ? ` · ${filtro}` : ''}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(totales.costo)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(totales.pvp)}</td>
              {descuento > 0 && <td />}
              <td />
              <td />
              <td className={`px-3 py-2 text-right tabular-nums ${margenColor(totales.margenProm)}`}>{pct(totales.margenProm)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>
    </div>
  );
}

// ---------- Simulador de margen ----------
function Simulador({ config, filas }: { config: Config; filas: Fila[] }) {
  const iva = config.ivaVenta;
  const [costo, setCosto] = useState(0);
  const [markup, setMarkup] = useState(config.markupVentaDefault);
  const [pvp, setPvp] = useState(0);
  const [marca, setMarca] = useState('');
  const [busq, setBusq] = useState('');
  const [abierto, setAbierto] = useState(false);

  const editCosto = (v: number) => { setCosto(v); if (v > 0) setPvp(pvpDesdeMarkup(v, markup, iva)); };
  const editMarkup = (v: number) => { setMarkup(v); if (costo > 0) setPvp(pvpDesdeMarkup(costo, v, iva)); };
  const editPvp = (v: number) => { setPvp(v); if (costo > 0) { const m = calcularMargen(costo, v, iva).markup; if (m != null) setMarkup(Math.round(m * 10) / 10); } };

  const margen = calcularMargen(costo, pvp, iva);
  const sugeridos = busq.trim().length >= 2
    ? filas.filter((f) => f.nombre.toLowerCase().includes(busq.toLowerCase()) || f.skuLiso.toLowerCase().includes(busq.toLowerCase())).slice(0, 6)
    : [];

  const traer = (f: Fila) => {
    setCosto(f.costoNeto ?? 0);
    setPvp(f.pvpEfectivo ?? 0);
    setMarca(f.marca);
    if (f.costoNeto && f.pvpEfectivo) { const m = calcularMargen(f.costoNeto, f.pvpEfectivo, iva).markup; if (m != null) setMarkup(Math.round(m * 10) / 10); }
    setBusq(''); setAbierto(false);
  };

  return (
    <Card padding="none" className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wide">Simulador de margen por producto</h3>
        <span className="text-[11px] text-stone-400">IVA {iva}%</span>
      </div>

      {/* Traer producto real */}
      <div className="relative">
        <button onClick={() => setAbierto((a) => !a)} className="text-xs font-semibold text-sky-700 hover:underline">🔍 Traer un producto real (en vez de simular a mano)</button>
        {abierto && (
          <div className="mt-2">
            <input autoFocus value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Buscá por nombre o SKU…" className={`${inp} w-full max-w-md`} />
            {sugeridos.length > 0 && (
              <div className="mt-1 border border-stone-200 rounded-xl divide-y divide-stone-100 max-w-md bg-white shadow-sm">
                {sugeridos.map((f) => (
                  <button key={f.gnId} onClick={() => traer(f)} className="w-full text-left px-3 py-2 hover:bg-stone-50 flex justify-between items-center gap-2">
                    <span className="text-sm text-stone-700 truncate">{f.nombre} <span className="text-stone-400 text-xs">· {f.skuLiso}</span></span>
                    <span className="text-xs text-stone-400 shrink-0">{money(f.pvpEfectivo)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1 block">Costo neto (sin IVA) $</label>
          <NumInput value={costo} onChange={editCosto} placeholder="0" className={`${inp} w-full`} />
        </div>
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1 block">Markup % (s/ costo)</label>
          <NumInput value={markup} onChange={editMarkup} placeholder="ej. 130" className={`${inp} w-full`} />
        </div>
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1 block">PVP (IVA incluido) $</label>
          <NumInput value={pvp} onChange={editPvp} placeholder="0" className={`${inp} w-full`} />
        </div>
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1 block">Marca (opcional)</label>
          <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Zattia / Stunned" className={`${inp} w-full`} />
        </div>
      </div>

      {costo > 0 && pvp > 0 ? (
        <div className="flex flex-wrap gap-6 text-sm border-t border-stone-100 pt-3">
          <div><span className="text-stone-400 text-xs block">PVP sin IVA</span><span className="font-semibold text-stone-700 tabular-nums">{money(margen.pvpSinIva)}</span></div>
          <div><span className="text-stone-400 text-xs block">Markup s/ costo</span><span className="font-semibold text-stone-700 tabular-nums">{pct(margen.markup)}</span></div>
          <div><span className="text-stone-400 text-xs block">Margen s/ PVP</span><span className={`font-semibold tabular-nums ${margenColor(margen.margen)}`}>{pct(margen.margen)}</span></div>
          <div><span className="text-stone-400 text-xs block">Ganancia $ / u</span><span className="font-semibold text-emerald-700 tabular-nums">{money((margen.pvpSinIva ?? 0) - costo)}</span></div>
        </div>
      ) : (
        <p className="text-xs text-stone-400 border-t border-stone-100 pt-3">Cargá el costo neto y el markup (o el PVP) para ver el margen.</p>
      )}
    </Card>
  );
}
