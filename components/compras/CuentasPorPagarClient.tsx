'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { NumInput } from '@/components/ui/NumInput';

interface Row {
  origen: 'compra' | 'gasto';
  id: string; fecha: string; concepto: string;
  monto: number; montoPagado: number; pendiente: number;
  estadoPago: string; href: string; pagoUrl: string;
}
interface Grupo { proveedorId: string; proveedorNombre: string; rows: Row[]; totalPendiente: number; }

const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
const inp = 'px-2.5 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';

export function CuentasPorPagarClient() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagoId, setPagoId] = useState<string | null>(null);
  const [estado, setEstado] = useState<'PARCIAL' | 'PAGADA'>('PAGADA');
  const [pagado, setPagado] = useState(0);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    const r = await fetch('/api/cuentas-por-pagar');
    if (r.ok) setGrupos(await r.json());
    setLoading(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const startPago = (row: Row) => {
    setPagoId(`${row.origen}-${row.id}`);
    setEstado('PAGADA');
    setPagado(row.monto); // por defecto, pago total
    setFecha(new Date().toISOString().slice(0, 10));
  };

  const registrar = async (row: Row) => {
    setSaving(true);
    const r = await fetch(row.pagoUrl, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estadoPago: estado, montoPagado: pagado, fechaPago: fecha }),
    });
    if (r.ok) { setPagoId(null); await cargar(); }
    setSaving(false);
  };

  const totalGlobal = grupos.reduce((s, g) => s + g.totalPendiente, 0);

  if (loading) return <p className="text-stone-400 text-sm text-center py-10">Cargando...</p>;
  if (grupos.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-10 text-center">
        <p className="text-stone-400 text-sm">No hay cuentas por pagar. Todo al día. 🎉</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-stone-900 rounded-2xl p-5 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Total a pagar</span>
        <span className="text-2xl font-bold text-amber-400 tabular-nums">{fmt$(totalGlobal)}</span>
      </div>

      {grupos.map((g) => (
        <div key={g.proveedorId} className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
            <span className="font-bold text-stone-800">{g.proveedorNombre}</span>
            <span className="text-sm text-stone-500">Pendiente: <strong className="text-stone-900">{fmt$(g.totalPendiente)}</strong></span>
          </div>
          {g.rows.map((row) => {
            const key = `${row.origen}-${row.id}`;
            return (
              <div key={key} className="px-5 py-3 border-t border-stone-100 first:border-0">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={row.href} className="text-sm text-stone-700 hover:text-stone-900 truncate">{row.concepto}</Link>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${row.estadoPago === 'PARCIAL' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                        {row.estadoPago.toLowerCase()}
                      </span>
                      <span className="text-xs bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full">{row.origen === 'compra' ? 'insumos' : 'gasto'}</span>
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {row.fecha} · total {fmt$(row.monto)}{row.montoPagado > 0 ? ` · pagado ${fmt$(row.montoPagado)}` : ''}
                    </p>
                  </div>
                  <span className="font-bold text-stone-900 tabular-nums shrink-0">{fmt$(row.pendiente)}</span>
                  {pagoId !== key && (
                    <button onClick={() => startPago(row)}
                      className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition">
                      Pagar
                    </button>
                  )}
                </div>

                {pagoId === key && (
                  <div className="mt-3 bg-stone-50 border border-stone-200 rounded-xl p-3 flex items-end gap-2 flex-wrap">
                    <div>
                      <label className="text-xs text-stone-500 mb-1 block">Estado</label>
                      <select value={estado} onChange={(e) => setEstado(e.target.value as 'PARCIAL' | 'PAGADA')} className={inp}>
                        <option value="PAGADA">Pagada</option>
                        <option value="PARCIAL">Parcial</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-stone-500 mb-1 block">Monto pagado $</label>
                      <NumInput value={pagado} onChange={setPagado} min="0" step="0.01" className={`w-28 ${inp}`} />
                    </div>
                    <div>
                      <label className="text-xs text-stone-500 mb-1 block">Fecha</label>
                      <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inp} />
                    </div>
                    <button onClick={() => registrar(row)} disabled={saving}
                      className="text-xs bg-stone-900 text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50">
                      {saving ? '...' : 'Confirmar'}
                    </button>
                    <button onClick={() => setPagoId(null)} className="text-xs text-stone-400 hover:text-stone-600 px-2 py-1.5">Cancelar</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
