'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { toast } from '@/components/ui/Toaster';
import { MultiImageDrop } from '@/components/ui/ImageDrop';
import type { Foto } from '@/lib/diseno/fotos';

interface Lanzamiento { id: string; nombre: string; marca: string; fotos: Foto[]; estado: string; fechaEstimada: string | null; notas: string | null; }

const ESTADOS = ['Confirmado', 'En producción', 'Lanzado'] as const;
const estadoClass: Record<string, string> = {
  'Confirmado':    'bg-amber-100 text-amber-700',
  'En producción': 'bg-sky-100 text-sky-700',
  'Lanzado':       'bg-emerald-100 text-emerald-700',
};

const inp = 'px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400';
const fechaInput = (f: string | null) => (f ? f.slice(0, 10) : '');

export function LanzamientosClient() {
  const [items, setItems] = useState<Lanzamiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState('');
  const [marca, setMarca] = useState<'Zattia' | 'Stunned'>('Zattia');
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/lanzamientos');
      if (r.ok) setItems(await r.json());
    } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const crear = async () => {
    if (!nombre.trim()) { toast.error('Poné un nombre'); return; }
    setCreando(true);
    const r = await fetch('/api/lanzamientos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nombre.trim(), marca }) });
    setCreando(false);
    if (r.ok) { const item = await r.json(); setItems((prev) => [item, ...prev]); setNombre(''); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo crear'); }
  };

  const guardar = async (id: string, patch: Partial<Lanzamiento>) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i));
    await fetch(`/api/lanzamientos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
  };

  const eliminar = async (item: Lanzamiento) => {
    if (!(await confirmAsync({ message: `¿Eliminar el lanzamiento "${item.nombre}"?`, danger: true, confirmLabel: 'Eliminar' }))) return;
    const r = await fetch(`/api/lanzamientos/${item.id}`, { method: 'DELETE' });
    if (r.ok) setItems((prev) => prev.filter((i) => i.id !== item.id)); else toast.error('No se pudo eliminar');
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Nuevo lanzamiento */}
      <Card padding="none" className="p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[12rem]">
          <label className="text-xs font-semibold text-stone-600 mb-1 block">Nuevo lanzamiento</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') crear(); }}
            placeholder="Nombre del diseño" className={`${inp} w-full`} />
        </div>
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1 block">Marca</label>
          <select value={marca} onChange={(e) => setMarca(e.target.value as 'Zattia' | 'Stunned')} className={inp}>
            <option value="Zattia">Zattia</option>
            <option value="Stunned">Stunned</option>
          </select>
        </div>
        <Button onClick={crear} isLoading={creando}>+ Cargar lanzamiento</Button>
      </Card>

      {cargando ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState title="Sin lanzamientos todavía" message="Cargá los diseños confirmados con su foto para que todo el equipo vea lo que se viene." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card key={item.id} padding="none" className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <input value={item.nombre} onChange={(e) => guardar(item.id, { nombre: e.target.value })}
                    className="font-semibold text-stone-800 text-sm w-full bg-transparent border-none focus:outline-none focus:bg-stone-50 rounded px-1 -ml-1" />
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${item.marca === 'Zattia' ? 'bg-violet-100 text-violet-700' : 'bg-pink-100 text-pink-700'}`}>{item.marca}</span>
              </div>

              <MultiImageDrop value={item.fotos} onChange={(fotos) => guardar(item.id, { fotos })} />

              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${estadoClass[item.estado] ?? 'bg-stone-100 text-stone-600'}`}>{item.estado}</span>
                <select value={item.estado} onChange={(e) => guardar(item.id, { estado: e.target.value })} className={`${inp} py-1 flex-1 min-w-[8rem]`}>
                  {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-stone-500 mb-1 block">Fecha estimada de lanzamiento</label>
                <input type="date" value={fechaInput(item.fechaEstimada)} onChange={(e) => guardar(item.id, { fechaEstimada: e.target.value || null })} className={`${inp} w-full`} />
              </div>

              <input value={item.notas ?? ''} onChange={(e) => setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, notas: e.target.value } : i))}
                onBlur={(e) => guardar(item.id, { notas: e.target.value })}
                placeholder="Notas (opcional)" className={`${inp} w-full`} />

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-stone-100">
                <button onClick={() => eliminar(item)} aria-label="Eliminar" className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">×</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
