'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';

interface SkuColor { id: string; nombre: string; abreviatura: string; }
interface InsumoColorItem {
  id: string;
  activo: boolean;
  skuCatalogo: { id: string; nombre: string; abreviatura: string };
}

export function InsumoColoresManager({ insumoId, insumoNombre }: { insumoId: string; insumoNombre: string }) {
  const [colores, setColores] = useState<InsumoColorItem[]>([]);
  const [disponibles, setDisponibles] = useState<SkuColor[]>([]);
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const cargar = () => {
    fetch(`/api/insumos/${insumoId}/colores`).then((r) => r.ok ? r.json() : []).then(setColores);
    fetch('/api/sku-catalogo?categoria=color').then((r) => r.ok ? r.json() : []).then(setDisponibles);
  };

  useEffect(cargar, [insumoId]);

  const asignados = new Set(colores.map((c) => c.skuCatalogo.id));
  const noAsignados = disponibles.filter((d) => !asignados.has(d.id));

  const agregar = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    const r = await fetch(`/api/insumos/${insumoId}/colores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skuCatalogoId: selected }),
    });
    if (r.ok) {
      const item = await r.json();
      setColores((prev) => [...prev.filter((c) => c.id !== item.id), item]);
      setSelected('');
    } else {
      const d = await r.json();
      setError(d.error || 'Error');
    }
    setSaving(false);
  };

  const toggleActivo = async (ic: InsumoColorItem) => {
    const r = await fetch(`/api/insumos/${insumoId}/colores`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insumoColorId: ic.id, activo: !ic.activo }),
    });
    if (r.ok) {
      const updated = await r.json();
      setColores((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    }
  };

  const inp = 'px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';

  return (
    <div className="space-y-5">
      <Card padding="none" className="p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Agregar color a {insumoNombre}</p>
        <div className="flex gap-2">
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className={`flex-1 ${inp}`}>
            <option value="">-- Seleccionar color --</option>
            {noAsignados.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre} ({c.abreviatura})</option>
            ))}
          </select>
          <button onClick={agregar} disabled={saving || !selected}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition">
            {saving ? '...' : 'Agregar'}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        {noAsignados.length === 0 && disponibles.length > 0 && (
          <p className="text-xs text-stone-400 mt-2">Todos los colores del catalogo ya estan asignados.</p>
        )}
      </Card>

      <Card padding="none" className="divide-y divide-stone-100">
        {colores.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-10">Sin colores asignados</p>
        ) : (
          colores.map((c) => (
            <div key={c.id} className={`flex items-center gap-3 px-5 py-3 ${!c.activo ? 'opacity-50' : ''}`}>
              <span className="flex-1 text-sm text-stone-800">{c.skuCatalogo.nombre}</span>
              <span className="text-xs font-mono text-stone-500">{c.skuCatalogo.abreviatura}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                {c.activo ? 'Activo' : 'Inactivo'}
              </span>
              <button onClick={() => toggleActivo(c)}
                className="text-xs px-2.5 py-1 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 transition">
                {c.activo ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
