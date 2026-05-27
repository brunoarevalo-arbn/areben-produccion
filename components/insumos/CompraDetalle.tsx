'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface CompraFull {
  id: string;
  fecha: string;
  numeroFactura: string | null;
  conIva: boolean;
  totalBruto: string;
  totalNeto: string;
  formaPago: string | null;
  estadoPago: string;
  montoPagado: string;
  fechaPago: string | null;
  notas: string | null;
  revertida: boolean;
  revertidaPor: string | null;
  creadoPor: string;
  creadoAt: string;
  proveedor: { id: string; nombre: string; cuit: string | null };
  lineas: {
    id: string;
    cantidad: string;
    unidad: string;
    precioUnitario: string;
    subtotal: string;
    insumo: { nombre: string; categoria: string; tipoTrazabilidad: string };
  }[];
  rollos: { id: string; codigo: string; pesoInicial: string; pesoActual: string; costoUnitario: string; estado: string; insumo: { nombre: string } }[];
  lotes: { id: string; codigo: string; cantidadInicial: string; cantidadActual: string; costoUnitario: string; estado: string; insumo: { nombre: string } }[];
}

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const fmt = (n: string | number) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

export function CompraDetalle({ compra: initial }: { compra: CompraFull }) {
  const router = useRouter();
  const [compra, setCompra] = useState(initial);
  const [showPago, setShowPago] = useState(false);
  const [estadoPago, setEstadoPago] = useState(compra.estadoPago);
  const [montoPagado, setMontoPagado] = useState(String(Number(compra.montoPagado)));
  const [fechaPago, setFechaPago] = useState(compra.fechaPago?.slice(0, 10) || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const guardarPago = async () => {
    setSaving(true);
    setError('');
    const r = await fetch(`/api/compras/${compra.id}/pago`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estadoPago,
        montoPagado: parseFloat(montoPagado) || 0,
        fechaPago: fechaPago || undefined,
      }),
    });
    if (r.ok) {
      const updated = await r.json();
      setCompra({ ...compra, estadoPago: updated.estadoPago, montoPagado: String(updated.montoPagado), fechaPago: updated.fechaPago });
      setShowPago(false);
    } else {
      const d = await r.json();
      setError(d.error || 'Error');
    }
    setSaving(false);
  };

  const revertir = async () => {
    if (!confirm('Esta accion revierte la compra completa: anula todos los rollos y lotes creados. Continuar?')) return;
    const r = await fetch(`/api/compras/${compra.id}/revertir`, { method: 'POST' });
    if (r.ok) {
      router.refresh();
      setCompra({ ...compra, revertida: true });
    } else {
      const d = await r.json();
      alert(d.error || 'Error al revertir');
    }
  };

  const fechaFmt = new Date(compra.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {compra.revertida && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-semibold">
          Compra revertida{compra.revertidaPor ? ` por ${compra.revertidaPor}` : ''}
        </div>
      )}

      {/* Cabecera */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8 text-sm">
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Proveedor</p>
            <p className="text-stone-800 font-medium">{compra.proveedor.nombre}</p>
            {compra.proveedor.cuit && <p className="text-xs text-stone-500">{compra.proveedor.cuit}</p>}
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Fecha</p>
            <p className="text-stone-800">{fechaFmt}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Factura</p>
            <p className="text-stone-800 font-mono">{compra.numeroFactura || '--'}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Total bruto</p>
            <p className="text-stone-800 font-bold text-lg">${fmt(compra.totalBruto)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Total neto</p>
            <p className="text-stone-800">${fmt(compra.totalNeto)}</p>
            {compra.conIva && <p className="text-xs text-stone-400">Con IVA incluido</p>}
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Estado de pago</p>
            <p className="text-stone-800">{compra.estadoPago}</p>
            {Number(compra.montoPagado) > 0 && <p className="text-xs text-stone-500">Pagado: ${fmt(compra.montoPagado)}</p>}
          </div>
        </div>
        {compra.notas && (
          <div className="mt-4 pt-4 border-t border-stone-100">
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Notas</p>
            <p className="text-sm text-stone-600">{compra.notas}</p>
          </div>
        )}
        {!compra.revertida && (
          <div className="mt-4 pt-4 border-t border-stone-100 flex gap-2">
            <button onClick={() => setShowPago(!showPago)}
              className="text-xs px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition">
              Actualizar pago
            </button>
            <button onClick={revertir}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition">
              Revertir compra
            </button>
          </div>
        )}
        {showPago && (
          <div className="mt-4 pt-4 border-t border-stone-100 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1 block">Estado</label>
                <select value={estadoPago} onChange={(e) => setEstadoPago(e.target.value)} className={inp}>
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="PARCIAL">Parcial</option>
                  <option value="PAGADA">Pagada</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1 block">Monto pagado</label>
                <input type="number" value={montoPagado} onChange={(e) => setMontoPagado(e.target.value)} min="0" step="0.01" className={inp} />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1 block">Fecha</label>
                <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} className={inp} />
              </div>
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button onClick={guardarPago} disabled={saving}
              className="bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold transition">
              {saving ? 'Guardando...' : 'Guardar pago'}
            </button>
          </div>
        )}
      </div>

      {/* Lineas */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-3">Lineas</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-stone-400 uppercase tracking-widest border-b border-stone-100">
              <th className="text-left py-2 font-bold">Insumo</th>
              <th className="text-right py-2 font-bold">Cantidad</th>
              <th className="text-right py-2 font-bold">Precio sin IVA</th>
              <th className="text-right py-2 font-bold">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {compra.lineas.map((l) => (
              <tr key={l.id} className="border-b border-stone-50">
                <td className="py-2.5">
                  <p className="text-stone-800 font-medium">{l.insumo.nombre}</p>
                  <p className="text-xs text-stone-400">{l.insumo.categoria} · {l.insumo.tipoTrazabilidad}</p>
                </td>
                <td className="text-right tabular-nums text-stone-700">{fmt(l.cantidad)} {l.unidad}</td>
                <td className="text-right tabular-nums text-stone-500">${fmt(l.precioUnitario)}</td>
                <td className="text-right tabular-nums text-stone-800 font-semibold">${fmt(l.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rollos */}
      {compra.rollos.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <h3 className="text-sm font-bold text-stone-800 mb-3">Rollos creados</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-stone-400 uppercase tracking-widest border-b border-stone-100">
                <th className="text-left py-2 font-bold">Codigo</th>
                <th className="text-left py-2 font-bold">Insumo</th>
                <th className="text-right py-2 font-bold">Peso inicial</th>
                <th className="text-right py-2 font-bold">Peso actual</th>
                <th className="text-right py-2 font-bold">Precio sin IVA</th>
                <th className="text-right py-2 font-bold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {compra.rollos.map((r) => (
                <tr key={r.id} className="border-b border-stone-50">
                  <td className="py-2">
                    <Link href={`/insumos/rollos/${r.id}`} className="font-mono text-stone-700 hover:text-amber-600 transition">
                      {r.codigo}
                    </Link>
                  </td>
                  <td className="text-stone-600">{r.insumo.nombre}</td>
                  <td className="text-right tabular-nums">{fmt(r.pesoInicial)}</td>
                  <td className="text-right tabular-nums">{fmt(r.pesoActual)}</td>
                  <td className="text-right tabular-nums text-stone-500">${fmt(r.costoUnitario)}</td>
                  <td className="text-right text-xs">{r.estado.replace(/_/g, ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lotes */}
      {compra.lotes.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <h3 className="text-sm font-bold text-stone-800 mb-3">Lotes creados</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-stone-400 uppercase tracking-widest border-b border-stone-100">
                <th className="text-left py-2 font-bold">Codigo</th>
                <th className="text-left py-2 font-bold">Insumo</th>
                <th className="text-right py-2 font-bold">Cantidad</th>
                <th className="text-right py-2 font-bold">Precio sin IVA</th>
                <th className="text-right py-2 font-bold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {compra.lotes.map((l) => (
                <tr key={l.id} className="border-b border-stone-50">
                  <td className="py-2 font-mono text-stone-700">{l.codigo}</td>
                  <td className="text-stone-600">{l.insumo.nombre}</td>
                  <td className="text-right tabular-nums">{fmt(l.cantidadActual)} / {fmt(l.cantidadInicial)}</td>
                  <td className="text-right tabular-nums text-stone-500">${fmt(l.costoUnitario)}</td>
                  <td className="text-right text-xs">{l.estado.replace(/_/g, ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
