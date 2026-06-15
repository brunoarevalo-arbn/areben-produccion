'use client';

import { useState, useEffect } from 'react';

interface Huerfano {
  id: string;
  tipo: 'rollo' | 'lote';
  codigo: string;
  cantidad: string;
  insumoId: string;
  insumoNombre: string;
  colorProveedor: string | null;
  coloresDisponibles: { id: string; nombre: string }[];
}

const inp = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';
const fmt = (n: string | number) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

export function SinColorClient() {
  const [items, setItems] = useState<Huerfano[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecciones, setSelecciones] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([
      fetch('/api/insumos/rollos').then((r) => r.ok ? r.json() : []),
      fetch('/api/insumos/lotes').then((r) => r.ok ? r.json() : []),
      fetch('/api/insumos').then((r) => r.ok ? r.json() : []),
    ]).then(([rollos, lotes, insumos]) => {
      type InsItem = { id: string; nombre: string };
      const insMap = new Map<string, InsItem>(insumos.map((i: InsItem) => [i.id, i]));
      const huerfanos: Huerfano[] = [];

      for (const r of rollos) {
        const ins = insMap.get(r.insumoId);
        if (ins && !r.colorId && r.estado !== 'DESCARTADO') {
          huerfanos.push({
            id: r.id, tipo: 'rollo', codigo: r.codigo,
            cantidad: r.pesoActual, insumoId: r.insumoId, insumoNombre: ins.nombre,
            colorProveedor: r.colorProveedor ?? null,
            coloresDisponibles: [],
          });
        }
      }

      for (const l of lotes) {
        const ins = insMap.get(l.insumoId);
        if (ins && !l.colorId && l.estado !== 'AGOTADO') {
          huerfanos.push({
            id: l.id, tipo: 'lote', codigo: l.codigo,
            cantidad: l.cantidadActual, insumoId: l.insumoId, insumoNombre: ins.nombre,
            colorProveedor: l.colorProveedor ?? null,
            coloresDisponibles: [],
          });
        }
      }

      // Cargar colores del catalogo SKU
      fetch('/api/sku-catalogo?categoria=color')
        .then((r) => r.ok ? r.json() : [])
        .then((colores: { id: string; nombre: string }[]) => {
          const opts = colores.map((c) => ({ id: c.id, nombre: c.nombre }));
          setItems(huerfanos.map((h) => ({ ...h, coloresDisponibles: opts })));
        });

      setItems(huerfanos);
    }).finally(() => setLoading(false));
  }, []);

  const asignar = async (item: Huerfano) => {
    const colorId = selecciones[item.id];
    if (!colorId) return;
    setSaving((prev) => ({ ...prev, [item.id]: true }));

    const endpoint = item.tipo === 'rollo'
      ? `/api/insumos/rollos/${item.id}`
      : `/api/insumos/lotes/${item.id}`;

    const r = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colorId }),
    });

    if (r.ok) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    }
    setSaving((prev) => ({ ...prev, [item.id]: false }));
  };

  return (
    <div className="space-y-5">
      {loading ? (
        <p className="text-stone-400 text-sm text-center py-10">Cargando...</p>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
          <p className="text-stone-400 text-sm">No hay rollos ni lotes sin color asignado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 grid grid-cols-[auto_auto_1fr_auto_auto_auto_auto] gap-4 text-xs font-bold uppercase tracking-widest text-stone-400">
            <span>Tipo</span>
            <span>Codigo</span>
            <span>Insumo</span>
            <span className="text-right">Cantidad</span>
            <span>Color prov.</span>
            <span>Color interno</span>
            <span />
          </div>
          {items.map((item, i) => (
            <div key={item.id}
              className={`px-5 py-3 grid grid-cols-[auto_auto_1fr_auto_auto_auto_auto] gap-4 items-center ${i > 0 ? 'border-t border-stone-100' : ''}`}>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.tipo === 'rollo' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                {item.tipo}
              </span>
              <span className="font-mono font-semibold text-sm text-stone-700">{item.codigo}</span>
              <span className="text-sm text-stone-800">{item.insumoNombre}</span>
              <span className="text-sm tabular-nums text-right text-stone-700">{fmt(item.cantidad)}</span>
              <span className="text-sm text-stone-600 font-medium">{item.colorProveedor || <span className="text-stone-300">—</span>}</span>
              <select value={selecciones[item.id] || ''}
                onChange={(e) => setSelecciones((prev) => ({ ...prev, [item.id]: e.target.value }))}
                className={inp}>
                <option value="">--</option>
                {item.coloresDisponibles.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              <button onClick={() => asignar(item)}
                disabled={!selecciones[item.id] || saving[item.id]}
                className="text-xs px-3 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-50 font-semibold transition">
                {saving[item.id] ? '...' : 'Asignar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
