'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { EstadoPagoBadge } from '@/components/ui/EstadoPagoBadge';
import { LoadingState } from '@/components/ui/LoadingState';

interface Fila {
  origen: 'compra' | 'gasto';
  id: string;
  fecha: string;
  proveedorNombre: string;
  concepto: string;
  monto: number;
  estadoPago: string | null;
  montoPagado: number;
  generaStock: boolean;
  revertida?: boolean;
  href: string;
}

const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

export function ComprasUnificadasClient() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todas' | 'compra' | 'gasto' | 'pendientes'>('todas');

  useEffect(() => {
    fetch('/api/compras-unificadas').then((r) => r.ok ? r.json() : []).then(setFilas).finally(() => setLoading(false));
  }, []);

  const visibles = filas.filter((f) => {
    if (filtro === 'todas') return true;
    if (filtro === 'compra') return f.origen === 'compra';
    if (filtro === 'gasto') return f.origen === 'gasto';
    if (filtro === 'pendientes') return !f.revertida && (f.estadoPago === 'PENDIENTE' || f.estadoPago === 'PARCIAL');
    return true;
  });

  const pill = (active: boolean) =>
    `px-4 py-1.5 rounded-full text-xs font-semibold border transition capitalize ${active ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'}`;

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(['todas', 'compra', 'gasto', 'pendientes'] as const).map((f) => (
          <button key={f} onClick={() => setFiltro(f)} className={pill(filtro === f)}>
            {f === 'compra' ? 'Insumos' : f === 'gasto' ? 'Gastos/otras' : f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
        {visibles.length === 0 && <p className="px-4 py-10 text-center text-stone-400 text-sm">Sin compras todavía</p>}
        {visibles.map((f) => (
          <Link key={`${f.origen}-${f.id}`} href={f.href} className={`flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition ${f.revertida ? 'opacity-60' : ''}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-stone-800">{f.proveedorNombre}</span>
                {f.generaStock
                  ? <Badge variant="violet">insumos</Badge>
                  : <Badge variant="default">gasto</Badge>}
                {f.revertida
                  ? <Badge variant="danger">revertida</Badge>
                  : f.estadoPago && <EstadoPagoBadge estado={f.estadoPago} />}
              </div>
              <p className="text-xs text-stone-500 mt-0.5 truncate">{f.concepto} · {f.fecha}</p>
            </div>
            <span className={`font-bold tabular-nums shrink-0 ${f.revertida ? 'text-stone-400 line-through' : 'text-stone-900'}`}>{fmt$(f.monto)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
