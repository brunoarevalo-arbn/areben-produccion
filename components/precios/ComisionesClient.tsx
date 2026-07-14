'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { NumInput } from '@/components/ui/NumInput';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { toast } from '@/components/ui/Toaster';

interface Forma {
  id: string; nombre: string; comisionPct: number; costoFinancieroPct: number;
  descuentoPct: number; aplicaImpuestos: boolean; diasAcreditacion: number;
}
interface Canal { id: string; nombre: string; costoPorVenta: number; costoEsPct: boolean; comisiones: Forma[]; }
interface Config { ivaVenta: number; iibbPct: number; dreiPct: number; gananciasPct: number; saldoIvaFavor: boolean; }

const inp = 'px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';

export function ComisionesClient() {
  const [config, setConfig] = useState<Config>({ ivaVenta: 21, iibbPct: 0, dreiPct: 0, gananciasPct: 0, saldoIvaFavor: false });
  const [canales, setCanales] = useState<Canal[]>([]);
  const [canalId, setCanalId] = useState<string>('');
  const [cargando, setCargando] = useState(true);
  const [nuevoCanal, setNuevoCanal] = useState('');
  const [nuevaForma, setNuevaForma] = useState('');

  const cargar = useCallback(async () => {
    try {
      const [rc, rk] = await Promise.all([fetch('/api/precios/config'), fetch('/api/precios/canales')]);
      if (rc.ok) setConfig(await rc.json());
      if (rk.ok) {
        const cs: Canal[] = await rk.json();
        setCanales(cs);
        setCanalId((prev) => prev || cs[0]?.id || '');
      }
    } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const canal = canales.find((c) => c.id === canalId);

  // ── Config de impuestos ──
  const guardarConfig = async (patch: Partial<Config>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
    await fetch('/api/precios/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
  };

  // ── Canales ──
  const agregarCanal = async () => {
    if (!nuevoCanal.trim()) return;
    const r = await fetch('/api/precios/canales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nuevoCanal.trim() }) });
    if (r.ok) { const c = await r.json(); setCanales((p) => [...p, c]); setCanalId(c.id); setNuevoCanal(''); }
    else toast.error('No se pudo crear el canal');
  };
  const guardarCanal = async (id: string, patch: Partial<Canal>) => {
    setCanales((p) => p.map((c) => c.id === id ? { ...c, ...patch } : c));
    await fetch(`/api/precios/canales/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
  };
  const eliminarCanal = async (c: Canal) => {
    if (!(await confirmAsync({ message: `¿Eliminar el canal "${c.nombre}" y todas sus formas de pago?`, danger: true, confirmLabel: 'Eliminar' }))) return;
    const r = await fetch(`/api/precios/canales/${c.id}`, { method: 'DELETE' });
    if (r.ok) { setCanales((p) => p.filter((x) => x.id !== c.id)); setCanalId((prev) => prev === c.id ? '' : prev); }
    else toast.error('No se pudo eliminar');
  };

  // ── Formas de pago ──
  const agregarForma = async () => {
    if (!nuevaForma.trim() || !canalId) return;
    const r = await fetch('/api/precios/formas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ canalId, nombre: nuevaForma.trim() }) });
    if (r.ok) { const f = await r.json(); setCanales((p) => p.map((c) => c.id === canalId ? { ...c, comisiones: [...c.comisiones, f] } : c)); setNuevaForma(''); }
    else toast.error('No se pudo agregar la forma de pago');
  };
  const guardarForma = async (id: string, patch: Partial<Forma>) => {
    setCanales((p) => p.map((c) => c.id !== canalId ? c : { ...c, comisiones: c.comisiones.map((f) => f.id === id ? { ...f, ...patch } : f) }));
    await fetch(`/api/precios/formas/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
  };
  const eliminarForma = async (f: Forma) => {
    const r = await fetch(`/api/precios/formas/${f.id}`, { method: 'DELETE' });
    if (r.ok) setCanales((p) => p.map((c) => c.id !== canalId ? c : { ...c, comisiones: c.comisiones.filter((x) => x.id !== f.id) }));
    else toast.error('No se pudo eliminar');
  };

  if (cargando) return <LoadingState />;

  return (
    <div className="space-y-6 max-w-5xl">
      <p className="text-sm text-stone-500">
        Margen neto real contemplando comisiones, costo financiero, IIBB, DREI, Ganancias e IVA. La configuración es <strong>compartida</strong>: la editan quienes tienen el permiso y la ve todo el equipo.
      </p>

      {/* 1 · Configuración de impuestos */}
      <Card padding="none" className="p-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-400">1 · Configuración</p>
        <div className="flex flex-wrap items-end gap-4">
          {([['ivaVenta', 'IVA %'], ['iibbPct', 'IIBB %'], ['dreiPct', 'DREI %'], ['gananciasPct', 'Ganancias %']] as const).map(([key, label]) => (
            <div key={key}>
              <label className="text-xs font-semibold text-stone-600 mb-1 block">{label}</label>
              <NumInput value={config[key]} onChange={(n) => setConfig((p) => ({ ...p, [key]: n }))} onBlur={() => guardarConfig({ [key]: config[key] } as Partial<Config>)} className={`${inp} w-24`} />
            </div>
          ))}
          <label className="flex items-center gap-2 pb-2 cursor-pointer">
            <input type="checkbox" checked={config.saldoIvaFavor} onChange={(e) => guardarConfig({ saldoIvaFavor: e.target.checked })} />
            <span className="text-sm text-stone-600">Saldo IVA a favor <strong>{config.saldoIvaFavor ? 'ACTIVO' : 'inactivo'}</strong></span>
          </label>
        </div>
      </Card>

      {/* 2 · Canales y formas de pago */}
      <Card padding="none" className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">2 · Comisiones por forma de pago y canal</p>
          <div className="flex items-end gap-2">
            <input value={nuevoCanal} onChange={(e) => setNuevoCanal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') agregarCanal(); }} placeholder="Nuevo canal (ej. Local)" className={`${inp} w-44`} />
            <Button size="sm" variant="secondary" onClick={agregarCanal}>+ Canal</Button>
          </div>
        </div>

        {canales.length === 0 ? (
          <EmptyState title="Sin canales" message="Creá un canal de venta (Local, Web, Mayorista…) para configurar sus formas de pago." />
        ) : (
          <>
            {/* Selector de canal + costo de canal */}
            <div className="flex flex-wrap items-end gap-4 pb-4 border-b border-stone-100">
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1 block">Canal</label>
                <select value={canalId} onChange={(e) => setCanalId(e.target.value)} className={inp}>
                  {canales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              {canal && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-stone-600 mb-1 block">Costo de canal por venta</label>
                    <div className="flex items-center gap-2">
                      <NumInput value={canal.costoPorVenta} onChange={(n) => setCanales((p) => p.map((c) => c.id === canal.id ? { ...c, costoPorVenta: n } : c))} onBlur={() => guardarCanal(canal.id, { costoPorVenta: canal.costoPorVenta })} className={`${inp} w-28`} />
                      <select value={canal.costoEsPct ? '%' : '$'} onChange={(e) => guardarCanal(canal.id, { costoEsPct: e.target.value === '%' })} className={inp}>
                        <option value="$">$</option>
                        <option value="%">%</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={() => eliminarCanal(canal)} className="text-xs px-3 py-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition ml-auto">Eliminar canal</button>
                </>
              )}
            </div>

            {/* Tabla de formas de pago */}
            {canal && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-stone-400 border-b border-stone-100">
                      <th className="px-2 py-2">Forma de pago</th>
                      <th className="px-2 py-2 text-right">Comisión %</th>
                      <th className="px-2 py-2 text-right">Costo financiero %</th>
                      <th className="px-2 py-2 text-right">Descuento %</th>
                      <th className="px-2 py-2 text-center">Aplica impuestos</th>
                      <th className="px-2 py-2 text-right">Días acred.</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {canal.comisiones.map((f) => (
                      <FilaForma key={f.id} f={f} onSave={guardarForma} onDelete={eliminarForma} />
                    ))}
                    {canal.comisiones.length === 0 && (
                      <tr><td colSpan={7} className="py-4 text-center text-stone-400 italic">Sin formas de pago. Agregá una abajo.</td></tr>
                    )}
                  </tbody>
                </table>
                <div className="flex items-end gap-2 mt-4">
                  <input value={nuevaForma} onChange={(e) => setNuevaForma(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') agregarForma(); }} placeholder="Nueva forma de pago (ej. Crédito 3 cuotas)" className={`${inp} w-64`} />
                  <Button size="sm" variant="secondary" onClick={agregarForma}>+ Agregar forma de pago</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function FilaForma({ f, onSave, onDelete }: { f: Forma; onSave: (id: string, patch: Partial<Forma>) => void; onDelete: (f: Forma) => void }) {
  const [local, setLocal] = useState(f);
  useEffect(() => { setLocal(f); }, [f]);
  const numCell = 'w-20 px-2 py-1 border border-stone-200 rounded-lg text-sm text-right focus:outline-none focus:border-amber-400 tabular-nums';
  const set = (patch: Partial<Forma>) => setLocal((p) => ({ ...p, ...patch }));
  const save = (patch: Partial<Forma>) => onSave(f.id, patch);
  return (
    <tr className="hover:bg-stone-50/60">
      <td className="px-2 py-2">
        <input value={local.nombre} onChange={(e) => set({ nombre: e.target.value })} onBlur={() => local.nombre !== f.nombre && save({ nombre: local.nombre })}
          className="font-medium text-stone-800 bg-transparent border-none focus:outline-none focus:bg-stone-50 rounded px-1 -ml-1 w-40" />
      </td>
      <td className="px-2 py-2 text-right"><NumInput value={local.comisionPct} onChange={(n) => set({ comisionPct: n })} onBlur={() => save({ comisionPct: local.comisionPct })} className={numCell} /></td>
      <td className="px-2 py-2 text-right"><NumInput value={local.costoFinancieroPct} onChange={(n) => set({ costoFinancieroPct: n })} onBlur={() => save({ costoFinancieroPct: local.costoFinancieroPct })} className={numCell} /></td>
      <td className="px-2 py-2 text-right"><NumInput value={local.descuentoPct} onChange={(n) => set({ descuentoPct: n })} onBlur={() => save({ descuentoPct: local.descuentoPct })} className={numCell} /></td>
      <td className="px-2 py-2 text-center"><input type="checkbox" checked={local.aplicaImpuestos} onChange={(e) => { set({ aplicaImpuestos: e.target.checked }); save({ aplicaImpuestos: e.target.checked }); }} /></td>
      <td className="px-2 py-2 text-right"><NumInput value={local.diasAcreditacion} onChange={(n) => set({ diasAcreditacion: n })} onBlur={() => save({ diasAcreditacion: local.diasAcreditacion })} className="w-16 px-2 py-1 border border-stone-200 rounded-lg text-sm text-right focus:outline-none focus:border-amber-400 tabular-nums" /></td>
      <td className="px-2 py-2 text-right"><button onClick={() => onDelete(f)} aria-label="Eliminar" className="text-red-400 hover:text-red-600 text-sm px-1">×</button></td>
    </tr>
  );
}
