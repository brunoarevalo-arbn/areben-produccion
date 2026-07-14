'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { NumInput } from '@/components/ui/NumInput';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { toast } from '@/components/ui/Toaster';
import { calcularMargenNeto } from '@/lib/costos/precios';

interface Fila {
  gnId: number; code: string | null; nombre: string; marca: string; skuLiso: string;
  costoNeto: number | null; pvpEfectivo: number | null; precioPromo: number | null; promoDescuentoPct: number | null;
}
interface Forma { id: string; nombre: string; comisionPct: number; costoFinancieroPct: number; descuentoPct: number; aplicaImpuestos: boolean; }
interface Canal { id: string; nombre: string; costoPorVenta: number; costoEsPct: boolean; comisiones: Forma[]; }
interface Config { ivaVenta: number; iibbPct: number; dreiPct: number; gananciasPct: number; saldoIvaFavor: boolean; }

const inp = 'px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const fmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const money = (n: number | null | undefined) => (n == null ? '—' : '$' + fmt.format(Math.round(n)));
const pct = (n: number | null | undefined) => (n == null ? '—' : `${(Math.round(n * 10) / 10).toString().replace('.', ',')}%`);
const marcaBadge = (m: string) => { const l = m.toLowerCase(); return l.includes('zattia') ? 'bg-violet-100 text-violet-700' : l.includes('stunned') ? 'bg-pink-100 text-pink-700' : 'bg-stone-100 text-stone-600'; };
const margenColor = (m: number | null) => (m == null ? 'text-stone-400' : m < 15 ? 'text-red-600 font-semibold' : m < 30 ? 'text-amber-600' : 'text-emerald-700');

export function SaleClient() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [config, setConfig] = useState<Config>({ ivaVenta: 21, iibbPct: 0, dreiPct: 0, gananciasPct: 0, saldoIvaFavor: false });
  const [canales, setCanales] = useState<Canal[]>([]);
  const [cargando, setCargando] = useState(true);
  const [canalId, setCanalId] = useState('');
  const [formaId, setFormaId] = useState('');
  const [descuento, setDescuento] = useState(0);
  const [descRow, setDescRow] = useState<Record<number, number>>({});
  const [expandido, setExpandido] = useState<number | null>(null);
  const [soloConfirmados, setSoloConfirmados] = useState(false);
  const [exportando, setExportando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [rf, rc, rk] = await Promise.all([fetch('/api/precios'), fetch('/api/precios/config'), fetch('/api/precios/canales')]);
      if (rf.ok) setFilas((await rf.json()).filas);
      if (rc.ok) setConfig(await rc.json());
      if (rk.ok) { const cs: Canal[] = await rk.json(); setCanales(cs); setCanalId((p) => p || cs[0]?.id || ''); }
    } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const canal = canales.find((c) => c.id === canalId);
  const forma = canal?.comisiones.find((f) => f.id === formaId) ?? canal?.comisiones[0];
  useEffect(() => { if (canal && !canal.comisiones.some((f) => f.id === formaId)) setFormaId(canal.comisiones[0]?.id ?? ''); }, [canalId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Margen neto de una fila con la forma/canal elegidos.
  const calcFila = (f: Fila) => {
    const dSale = descRow[f.gnId] ?? descuento;
    const precioPromoLista = f.pvpEfectivo != null ? f.pvpEfectivo * (1 - dSale / 100) : null; // lo que se sube a GN (solo desc. Sale)
    if (f.pvpEfectivo == null || !canal || !forma) return { dSale, precioPromoLista, calc: null };
    const calc = calcularMargenNeto({
      pvp: f.pvpEfectivo, costo: f.costoNeto, descuentoSalePct: dSale, descuentoFormaPct: forma.descuentoPct,
      comisionPct: forma.comisionPct, costoFinancieroPct: forma.costoFinancieroPct,
      costoCanal: canal.costoPorVenta, costoCanalEsPct: canal.costoEsPct, aplicaImpuestos: forma.aplicaImpuestos,
      ivaPct: config.ivaVenta, iibbPct: config.iibbPct, dreiPct: config.dreiPct, gananciasPct: config.gananciasPct, saldoIvaFavor: config.saldoIvaFavor,
    });
    return { dSale, precioPromoLista, calc };
  };

  const visibles = useMemo(() => (soloConfirmados ? filas.filter((f) => f.precioPromo != null) : filas), [filas, soloConfirmados]);
  const nConfirmados = filas.filter((f) => f.precioPromo != null).length;

  // Confirmar / desconfirmar promo
  const guardarPromo = async (f: Fila, precioPromo: number | null, dSale: number | null) => {
    setFilas((prev) => prev.map((x) => x.gnId === f.gnId ? { ...x, precioPromo, promoDescuentoPct: precioPromo != null ? dSale : null } : x));
    await fetch(`/api/precios/${f.gnId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ precioPromo, promoDescuentoPct: precioPromo != null ? dSale : null }) });
  };
  const confirmar = (f: Fila) => { const { dSale, precioPromoLista } = calcFila(f); if (precioPromoLista == null) { toast.error('El producto no tiene PVP'); return; } guardarPromo(f, Math.round(precioPromoLista), dSale); };
  const limpiarUno = (f: Fila) => guardarPromo(f, null, null);

  const limpiarTodos = async () => {
    if (!(await confirmAsync({ message: `¿Limpiar los ${nConfirmados} precios promocionales confirmados?`, danger: true, confirmLabel: 'Limpiar' }))) return;
    const conf = filas.filter((f) => f.precioPromo != null);
    setFilas((prev) => prev.map((x) => ({ ...x, precioPromo: null, promoDescuentoPct: null })));
    await Promise.all(conf.map((f) => fetch(`/api/precios/${f.gnId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ precioPromo: null }) })));
  };

  const exportar = () => {
    setExportando(true);
    const a = document.createElement('a');
    a.href = `/api/precios/sale/export?fecha=${new Date().toISOString().slice(0, 10)}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => setExportando(false), 800);
  };

  if (cargando) return <LoadingState />;
  if (!canal || (canal.comisiones.length === 0)) return (
    <EmptyState title="Falta configurar comisiones" message="Creá al menos un canal con formas de pago en Comisiones y medios de pago para simular el margen."
      action={<Link href="/precios/comisiones" className="text-sm font-semibold text-amber-700 hover:underline">Ir a Comisiones →</Link>} />
  );

  return (
    <div className="space-y-6">
      {/* Controles */}
      <Card padding="none" className="p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1 block">Canal</label>
          <select value={canalId} onChange={(e) => setCanalId(e.target.value)} className={inp}>
            {canales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1 block">Forma de pago</label>
          <select value={forma?.id ?? ''} onChange={(e) => setFormaId(e.target.value)} className={inp}>
            {canal.comisiones.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1 block">Descuento Sale %</label>
          <NumInput value={descuento} onChange={setDescuento} min="0" max="100" placeholder="0" className={`${inp} w-24`} />
        </div>
        <p className="text-xs text-stone-500 flex-1 min-w-[12rem]">
          El margen neto contempla la comisión y el costo financiero de <strong>{forma?.nombre}</strong>
          {forma?.aplicaImpuestos
            ? <> más IVA, IIBB, DREI y Ganancias.{config.saldoIvaFavor && <span className="text-emerald-600"> IVA a favor: el IVA no se paga (compensado con crédito).</span>}</>
            : <> · <span className="text-amber-600">sin factura: no descuenta IVA ni impuestos.</span></>}
        </p>
      </Card>

      {/* Acciones de confirmados */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" checked={soloConfirmados} onChange={(e) => setSoloConfirmados(e.target.checked)} /> Solo confirmados
        </label>
        <span className="text-sm text-stone-500">{nConfirmados} confirmado(s)</span>
        <div className="flex-1" />
        {nConfirmados > 0 && <Button variant="secondary" onClick={limpiarTodos}>Limpiar confirmados</Button>}
        <Button onClick={exportar} isLoading={exportando} disabled={nConfirmados === 0}>Exportar Excel ({nConfirmados})</Button>
      </div>

      {/* Tabla */}
      <Card padding="none" className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-stone-400 border-b border-stone-100">
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2">Marca</th>
              <th className="px-3 py-2 text-right">Costo</th>
              <th className="px-3 py-2 text-right">PVP</th>
              <th className="px-3 py-2 text-right">Desc. %</th>
              <th className="px-3 py-2 text-right">Precio promo</th>
              <th className="px-3 py-2 text-right">Margen neto</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {visibles.map((f) => {
              const { dSale, precioPromoLista, calc } = calcFila(f);
              const confirmado = f.precioPromo != null;
              const abierto = expandido === f.gnId;
              return (
                <Fragment key={f.gnId}>
                  <tr className={`hover:bg-stone-50/60 ${confirmado ? 'bg-emerald-50/40' : ''}`}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-stone-800 leading-tight">{f.nombre}</p>
                      <p className="text-[11px] text-stone-400">{f.skuLiso}</p>
                    </td>
                    <td className="px-3 py-2"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${marcaBadge(f.marca)}`}>{f.marca || '—'}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums text-stone-500">{money(f.costoNeto)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(f.pvpEfectivo)}</td>
                    <td className="px-3 py-2 text-right">
                      <NumInput value={descRow[f.gnId] ?? dSale} onChange={(n) => setDescRow((p) => ({ ...p, [f.gnId]: n }))}
                        className="w-16 px-2 py-1 border border-stone-200 rounded-lg text-sm text-right focus:outline-none focus:border-amber-400 tabular-nums" />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-700">{money(precioPromoLista)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${margenColor(calc?.margenNetoPct ?? null)}`}>
                      {calc ? pct(calc.margenNetoPct) : '—'}
                      {calc && <button onClick={() => setExpandido(abierto ? null : f.gnId)} className="ml-1 text-stone-300 hover:text-stone-500 text-xs">{abierto ? '▾' : '▸'}</button>}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {confirmado
                        ? <button onClick={() => limpiarUno(f)} className="text-xs font-semibold text-emerald-700 hover:underline" title={`Confirmado ${money(f.precioPromo)}`}>✓ {money(f.precioPromo)}</button>
                        : <Button size="sm" onClick={() => confirmar(f)}>Confirmar</Button>}
                    </td>
                  </tr>
                  {abierto && calc && (
                    <tr className="bg-stone-50/60">
                      <td colSpan={8} className="px-6 py-3">
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-stone-600">
                          <span>Precio cobrado (c/desc {pct(calc.descuentoTotalPct)}): <b className="tabular-nums">{money(calc.precioCobrado)}</b></span>
                          <span>Neto s/IVA: <b className="tabular-nums">{money(calc.precioNeto)}</b></span>
                          <span className={config.saldoIvaFavor ? 'text-emerald-600' : ''}>− IVA: <b className="tabular-nums">{money(calc.ivaDebito)}</b>{config.saldoIvaFavor ? ' (no se paga)' : ''}</span>
                          <span>− Costo: <b className="tabular-nums">{money(calc.costo)}</b></span>
                          <span>− Comisión: <b className="tabular-nums">{money(calc.comision)}</b></span>
                          {calc.costoFinanciero > 0 && <span>− Costo financiero: <b className="tabular-nums">{money(calc.costoFinanciero)}</b></span>}
                          {calc.costoCanal > 0 && <span>− Canal: <b className="tabular-nums">{money(calc.costoCanal)}</b></span>}
                          {calc.iibb > 0 && <span>− IIBB: <b className="tabular-nums">{money(calc.iibb)}</b></span>}
                          {calc.drei > 0 && <span>− DREI: <b className="tabular-nums">{money(calc.drei)}</b></span>}
                          {calc.ganancias > 0 && <span>− Ganancias: <b className="tabular-nums">{money(calc.ganancias)}</b></span>}
                          <span className="text-stone-800">= Margen neto: <b className="tabular-nums">{money(calc.margenNeto)}</b> ({pct(calc.margenNetoPct)})</span>
                          {config.saldoIvaFavor && <span className="text-emerald-600">Margen sin pagar IVA: <b className="tabular-nums">{money(calc.margenSinPagarIva)}</b></span>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
