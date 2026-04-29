'use client';

import { useState, useEffect, useCallback } from 'react';

interface Orden {
  id: string;
  sku: string;
  descripcion: string | null;
  marca: string;
  cantidad: number;
  estado: string;
  notas: string | null;
}

export function ColaCosturera() {
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/produccion/cola?soloActivas=1');
      if (r.ok) setOrdenes(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiarEstado = async (id: string, estado: string) => {
    setUpdating(id);
    const r = await fetch(`/api/produccion/cola/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    });
    if (r.ok) {
      if (estado === 'terminado') {
        setOrdenes((prev) => prev.filter((o) => o.id !== id));
      } else {
        const updated = await r.json();
        setOrdenes((prev) => prev.map((o) => o.id === id ? updated : o));
      }
    }
    setUpdating(null);
  };

  const enProduccion = ordenes.filter((o) => o.estado === 'en_produccion');
  const pendientes   = ordenes.filter((o) => o.estado === 'pendiente');

  if (loading) {
    return (
      <div className="mx-4 mb-2 bg-stone-800 rounded-2xl px-4 py-3 text-center text-stone-500 text-xs">
        Cargando cola...
      </div>
    );
  }

  if (ordenes.length === 0) {
    return (
      <div className="mx-4 mb-2 bg-stone-800 rounded-2xl px-4 py-3 text-center text-stone-500 text-xs">
        Sin órdenes pendientes
      </div>
    );
  }

  return (
    <div className="mx-4 mb-2 space-y-2">
      <p className="text-xs font-bold uppercase tracking-widest text-stone-500 px-1">
        Cola de trabajo
      </p>

      {/* En producción primero */}
      {enProduccion.map((orden) => (
        <div key={orden.id} className="bg-emerald-900 border border-emerald-700 rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-emerald-300 text-sm">{orden.sku}</span>
              <span className="text-xs text-emerald-600">{orden.marca}</span>
              <span className="text-xs bg-emerald-700 text-emerald-200 px-1.5 py-0.5 rounded-full font-semibold">En curso</span>
            </div>
            {orden.descripcion && <p className="text-xs text-emerald-400 mt-0.5 truncate">{orden.descripcion}</p>}
            <p className="text-xs text-emerald-600 mt-0.5">Cantidad: {orden.cantidad}</p>
          </div>
          <button
            onClick={() => cambiarEstado(orden.id, 'terminado')}
            disabled={updating === orden.id}
            className="shrink-0 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl transition active:scale-95"
          >
            {updating === orden.id ? '...' : 'Terminado'}
          </button>
        </div>
      ))}

      {/* Pendientes */}
      {pendientes.map((orden) => (
        <div key={orden.id} className="bg-stone-800 border border-stone-700 rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <span className="font-mono font-bold text-amber-400 text-sm">{orden.sku}</span>
            {orden.descripcion && <p className="text-xs text-stone-400 mt-0.5 truncate">{orden.descripcion}</p>}
            <p className="text-xs text-stone-600 mt-0.5">Cantidad: {orden.cantidad}</p>
          </div>
          <button
            onClick={() => cambiarEstado(orden.id, 'en_produccion')}
            disabled={updating === orden.id}
            className="shrink-0 border border-amber-600 text-amber-400 hover:bg-amber-900 disabled:opacity-50 text-xs font-semibold px-4 py-2 rounded-xl transition active:scale-95"
          >
            {updating === orden.id ? '...' : 'Tomar'}
          </button>
        </div>
      ))}
    </div>
  );
}
