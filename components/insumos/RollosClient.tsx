'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LoadingState } from '@/components/ui/LoadingState';

interface Rollo {
  id: string;
  codigo: string;
  pesoInicial: string;
  pesoActual: string;
  costoUnitario: string;
  estado: string;
  ubicacion: string | null;
  createdAt: string;
  insumo: { nombre: string; categoria: string; unidadDefault: string };
  color: { nombre: string } | null;
  colorProveedor: string | null;
  compra: { id: string; fecha: string; proveedor: { nombre: string } };
}

const ESTADO_COLOR: Record<string, string> = {
  DISPONIBLE:      'bg-emerald-100 text-emerald-700',
  EN_USO_PARCIAL:  'bg-amber-100 text-amber-700',
  AGOTADO:         'bg-stone-100 text-stone-500',
  DESCARTADO:      'bg-red-100 text-red-600',
};

const fmt = (n: string | number) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

export function RollosClient() {
  const [rollos, setRollos]   = useState<Rollo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');

  useEffect(() => {
    const params = filtroEstado ? `?estado=${filtroEstado}` : '';
    fetch(`/api/insumos/rollos${params}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setRollos)
      .finally(() => setLoading(false));
  }, [filtroEstado]);

  const sinColor = rollos.filter((r) => !r.color && r.estado !== 'DESCARTADO').length;

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {['', 'DISPONIBLE', 'EN_USO_PARCIAL', 'AGOTADO', 'DESCARTADO'].map((e) => (
          <button key={e} onClick={() => { setLoading(true); setFiltroEstado(e); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${filtroEstado === e ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'}`}>
            {e ? e.replace(/_/g, ' ') : 'Todos'}
          </button>
        ))}
      </div>

      {sinColor > 0 && (
        <Link href="/inventario/rollos/sin-color"
          className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800 hover:bg-amber-100 transition">
          🎨 {sinColor} {sinColor === 1 ? 'rollo' : 'rollos'} sin color interno asignado —
          <span className="font-semibold underline">asignar color</span>
        </Link>
      )}

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto"><div className="min-w-[760px]">
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 text-xs font-bold uppercase tracking-widest text-stone-400">
          <span>Codigo</span>
          <span>Insumo</span>
          <span>Proveedor</span>
          <span className="text-right">Peso</span>
          <span className="text-right">$/u</span>
          <span>Estado</span>
          <span />
        </div>

        {loading ? (
          <LoadingState />
        ) : rollos.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-10">Sin rollos</p>
        ) : (
          rollos.map((r, i) => (
            <div key={r.id}
              className={`px-5 py-3 grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 items-center ${i > 0 ? 'border-t border-stone-100' : ''}`}>
              <span className="font-mono font-semibold text-sm text-stone-700">{r.codigo}</span>
              <div className="min-w-0">
                <p className="text-sm text-stone-800 truncate">
                  {r.insumo.nombre}
                  {r.color
                    ? ` · ${r.color.nombre}`
                    : r.colorProveedor
                      ? <span className="text-stone-400 italic"> · {r.colorProveedor}</span>
                      : ''}
                </p>
                <p className="text-xs text-stone-400">{r.insumo.categoria}</p>
              </div>
              <span className="text-xs text-stone-500">{r.compra.proveedor.nombre}</span>
              <span className="text-sm tabular-nums text-right text-stone-700">
                {fmt(r.pesoActual)} / {fmt(r.pesoInicial)}
              </span>
              <span className="text-xs tabular-nums text-right text-stone-500">${fmt(r.costoUnitario)}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${ESTADO_COLOR[r.estado] || ''}`}>
                {r.estado.replace(/_/g, ' ')}
              </span>
              <Link href={`/inventario/rollos/${r.id}`}
                className="text-xs px-2.5 py-1 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition">
                Ver
              </Link>
            </div>
          ))
        )}
        </div></div>
      </div>
    </div>
  );
}
