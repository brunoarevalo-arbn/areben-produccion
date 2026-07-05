'use client';

import { useState, useEffect } from 'react';
import { LoadingState } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toaster';

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
const GRID = 'grid grid-cols-[auto_auto_auto_1fr_auto_auto_auto_auto] gap-4';

export function SinColorClient() {
  const [items, setItems] = useState<Huerfano[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecciones, setSelecciones] = useState<Record<string, string>>({});
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [bulkSaving, setBulkSaving] = useState(false);

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

      // Cargar colores del catalogo SKU y pre-seleccionar por coincidencia de nombre
      // con el color del proveedor (ej. "Negro" → Negro), para no cargar a mano lo obvio.
      fetch('/api/sku-catalogo?categoria=color')
        .then((r) => r.ok ? r.json() : [])
        .then((colores: { id: string; nombre: string }[]) => {
          const opts = colores.map((c) => ({ id: c.id, nombre: c.nombre }));
          const porNombre = new Map(opts.map((c) => [c.nombre.trim().toLowerCase(), c.id]));
          const pre: Record<string, string> = {};
          for (const h of huerfanos) {
            const match = h.colorProveedor ? porNombre.get(h.colorProveedor.trim().toLowerCase()) : undefined;
            if (match) pre[h.id] = match;
          }
          setSelecciones(pre);
          setItems(huerfanos.map((h) => ({ ...h, coloresDisponibles: opts })));
        });

      setItems(huerfanos);
    }).finally(() => setLoading(false));
  }, []);

  const patchColor = async (item: Huerfano, colorId: string) => {
    const endpoint = item.tipo === 'rollo' ? `/api/insumos/rollos/${item.id}` : `/api/insumos/lotes/${item.id}`;
    const r = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colorId }),
    });
    return r.ok;
  };

  const asignar = async (item: Huerfano) => {
    const colorId = selecciones[item.id];
    if (!colorId) return;
    setSaving((prev) => ({ ...prev, [item.id]: true }));
    const ok = await patchColor(item, colorId);
    if (ok) quitar([item.id]);
    else toast.error(`No se pudo asignar ${item.codigo}`);
    setSaving((prev) => ({ ...prev, [item.id]: false }));
  };

  const quitar = (ids: string[]) => {
    const set = new Set(ids);
    setItems((prev) => prev.filter((i) => !set.has(i.id)));
    setMarcados((prev) => { const n = new Set(prev); for (const id of ids) n.delete(id); return n; });
  };

  const toggleMarcado = (id: string) =>
    setMarcados((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Filas marcadas que además tienen un color elegido (las únicas asignables en lote).
  const marcadosListos = items.filter((i) => marcados.has(i.id) && selecciones[i.id]);
  const todosMarcados = items.length > 0 && items.every((i) => marcados.has(i.id));

  const toggleTodos = () =>
    setMarcados(todosMarcados ? new Set() : new Set(items.map((i) => i.id)));

  const asignarSeleccionados = async () => {
    if (marcadosListos.length === 0) return;
    setBulkSaving(true);
    const results = await Promise.all(
      marcadosListos.map(async (item) => ({ id: item.id, ok: await patchColor(item, selecciones[item.id]) })),
    );
    const exitosos = results.filter((r) => r.ok).map((r) => r.id);
    if (exitosos.length) quitar(exitosos);
    const fallidos = results.length - exitosos.length;
    if (fallidos > 0) toast.error(`${fallidos} no se pudieron asignar`);
    else toast.success(`${exitosos.length} ${exitosos.length === 1 ? 'asignado' : 'asignados'}`);
    setBulkSaving(false);
  };

  if (loading) return <LoadingState />;
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
        <p className="text-stone-400 text-sm">No hay rollos ni lotes sin color asignado.</p>
      </div>
    );
  }

  const marcadosSinColor = marcados.size - marcadosListos.length;

  return (
    <div className="space-y-4">
      {/* Barra de acción en lote */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-stone-500">
          {marcados.size > 0
            ? <>{marcados.size} seleccionado{marcados.size === 1 ? '' : 's'}{marcadosSinColor > 0 && <span className="text-amber-600"> · {marcadosSinColor} sin color elegido</span>}</>
            : `${items.length} sin color`}
        </span>
        <Button variant="primary" size="sm" onClick={asignarSeleccionados}
          isLoading={bulkSaving} disabled={marcadosListos.length === 0}>
          Asignar seleccionados {marcadosListos.length > 0 ? `(${marcadosListos.length})` : ''}
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto"><div className="min-w-[820px]">
        <div className={`px-5 py-3 bg-stone-50 border-b border-stone-100 ${GRID} text-xs font-bold uppercase tracking-widest text-stone-400`}>
          <input type="checkbox" checked={todosMarcados} onChange={toggleTodos} aria-label="Seleccionar todos"
            className="rounded border-stone-300 accent-amber-500" />
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
            className={`px-5 py-3 ${GRID} items-center ${i > 0 ? 'border-t border-stone-100' : ''} ${marcados.has(item.id) ? 'bg-amber-50/40' : ''}`}>
            <input type="checkbox" checked={marcados.has(item.id)} onChange={() => toggleMarcado(item.id)}
              aria-label={`Seleccionar ${item.codigo}`} className="rounded border-stone-300 accent-amber-500" />
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
        </div></div>
      </div>
    </div>
  );
}
