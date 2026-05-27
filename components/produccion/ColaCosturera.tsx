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

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/produccion/cola');
      if (r.ok) {
        const all = await r.json();
        setOrdenes(all.filter((o: Orden) => o.estado === 'COSTURA'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

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
        Sin ordenes en costura
      </div>
    );
  }

  return (
    <div className="mx-4 mb-2 space-y-2">
      <p className="text-xs font-bold uppercase tracking-widest text-stone-500 px-1">
        Cola de trabajo
      </p>
      {ordenes.map((orden) => (
        <div key={orden.id} className="bg-emerald-900 border border-emerald-700 rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-emerald-300 text-sm">{orden.sku}</span>
              <span className="text-xs text-emerald-600">{orden.marca}</span>
              <span className="text-xs bg-emerald-700 text-emerald-200 px-1.5 py-0.5 rounded-full font-semibold">Costura</span>
            </div>
            {orden.descripcion && <p className="text-xs text-emerald-400 mt-0.5 truncate">{orden.descripcion}</p>}
            <p className="text-xs text-emerald-600 mt-0.5">Cantidad: {orden.cantidad}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
