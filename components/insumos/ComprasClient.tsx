'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Compra {
  id: string;
  fecha: string;
  numeroFactura: string | null;
  totalBruto: string;
  totalNeto: string;
  estadoPago: string;
  revertida: boolean;
  creadoPor: string;
  proveedor: { nombre: string };
  lineas: { id: string }[];
}

const ESTADO_PAGO_COLOR: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700',
  PARCIAL:   'bg-blue-100 text-blue-700',
  PAGADA:    'bg-emerald-100 text-emerald-700',
};

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const fmt = (n: string | number) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });

export function ComprasClient() {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/compras')
      .then((r) => r.ok ? r.json() : [])
      .then(setCompras)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/inventario/compras/nueva"
          className="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
          + Nueva compra
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 text-xs font-bold uppercase tracking-widest text-stone-400">
          <span>Fecha</span>
          <span>Proveedor</span>
          <span>Factura</span>
          <span className="text-right">Total</span>
          <span>Pago</span>
          <span />
        </div>

        {loading ? (
          <p className="text-sm text-stone-400 text-center py-10">Cargando...</p>
        ) : compras.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-10">Sin compras registradas</p>
        ) : (
          compras.map((c, i) => (
            <div key={c.id}
              className={`px-5 py-3.5 grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center ${i > 0 ? 'border-t border-stone-100' : ''} ${c.revertida ? 'opacity-40 line-through' : ''}`}>
              <span className="text-xs text-stone-500 whitespace-nowrap">{fechaCorta(c.fecha)}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-800 truncate">{c.proveedor.nombre}</p>
                <p className="text-xs text-stone-400">{c.lineas.length} lineas · por {c.creadoPor}</p>
              </div>
              <span className="text-xs font-mono text-stone-500">{c.numeroFactura || '--'}</span>
              <span className="text-sm font-bold text-stone-800 tabular-nums text-right">${fmt(c.totalBruto)}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${ESTADO_PAGO_COLOR[c.estadoPago] || 'bg-stone-100'}`}>
                {c.estadoPago}
              </span>
              <Link href={`/inventario/compras/${c.id}`}
                className="text-xs px-2.5 py-1 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition">
                Ver
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
