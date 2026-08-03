'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { toast } from '@/components/ui/Toaster';
import { MultiImageDrop } from '@/components/ui/ImageDrop';
import type { Foto } from '@/lib/diseno/fotos';

interface Idea { id: string; nombre: string; marca: string; fotos: Foto[]; notas: string | null; proyectoId: string | null; }

const inp = 'px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400';

export function MoodboardClient() {
  const router = useRouter();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState('');
  const [marca, setMarca] = useState<'Zattia' | 'Stunned'>('Zattia');
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/ideas');
      if (r.ok) setIdeas(await r.json());
    } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const crear = async () => {
    if (!nombre.trim()) { toast.error('Poné un nombre'); return; }
    setCreando(true);
    const r = await fetch('/api/ideas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nombre.trim(), marca }) });
    setCreando(false);
    if (r.ok) { const idea = await r.json(); setIdeas((prev) => [idea, ...prev]); setNombre(''); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo crear'); }
  };

  const guardar = async (id: string, patch: Partial<Idea>) => {
    setIdeas((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i));
    await fetch(`/api/ideas/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
  };

  const eliminar = async (idea: Idea) => {
    if (!(await confirmAsync({ message: `¿Eliminar la idea "${idea.nombre}"?`, danger: true, confirmLabel: 'Eliminar' }))) return;
    const r = await fetch(`/api/ideas/${idea.id}`, { method: 'DELETE' });
    if (r.ok) setIdeas((prev) => prev.filter((i) => i.id !== idea.id)); else toast.error('No se pudo eliminar');
  };

  const convertir = async (idea: Idea) => {
    if (!(await confirmAsync({ message: `Convertir "${idea.nombre}" en un proyecto. Las fotos pasan como moodboard. ¿Seguir?`, confirmLabel: 'Convertir' }))) return;
    const r = await fetch(`/api/ideas/${idea.id}/convertir`, { method: 'POST' });
    if (r.ok) { const { proyectoId } = await r.json(); router.push(`/diseno/${proyectoId}`); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo convertir'); }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Nueva idea */}
      <Card padding="none" className="p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[12rem]">
          <label className="text-xs font-semibold text-stone-600 mb-1 block">Nueva idea</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') crear(); }}
            placeholder="Nombre de la idea" className={`${inp} w-full`} />
        </div>
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1 block">Marca</label>
          <select value={marca} onChange={(e) => setMarca(e.target.value as 'Zattia' | 'Stunned')} className={inp}>
            <option value="Zattia">Zattia</option>
            <option value="Stunned">Stunned</option>
          </select>
        </div>
        <Button onClick={crear} isLoading={creando}>+ Crear idea</Button>
      </Card>

      {cargando ? (
        <LoadingState />
      ) : ideas.length === 0 ? (
        <EmptyState title="Sin ideas todavía" message="Creá una idea, cargale fotos y cuando esté lista convertila en proyecto." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ideas.map((idea) => (
            <Card key={idea.id} padding="none" className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <input value={idea.nombre} onChange={(e) => guardar(idea.id, { nombre: e.target.value })}
                    className="font-semibold text-stone-800 text-sm w-full bg-transparent border-none focus:outline-none focus:bg-stone-50 rounded px-1 -ml-1" />
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${idea.marca === 'Zattia' ? 'bg-violet-100 text-violet-700' : 'bg-pink-100 text-pink-700'}`}>{idea.marca}</span>
              </div>

              <MultiImageDrop value={idea.fotos} onChange={(fotos) => guardar(idea.id, { fotos })} />

              <input value={idea.notas ?? ''} onChange={(e) => setIdeas((prev) => prev.map((i) => i.id === idea.id ? { ...i, notas: e.target.value } : i))}
                onBlur={(e) => guardar(idea.id, { notas: e.target.value })}
                placeholder="Notas (opcional)" className={`${inp} w-full`} />

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-100">
                {idea.proyectoId ? (
                  <Link href={`/diseno/${idea.proyectoId}`} className="text-xs font-semibold text-emerald-700 hover:underline">Convertida ✓ · ver proyecto</Link>
                ) : (
                  <Button size="sm" onClick={() => convertir(idea)}>Convertir en proyecto</Button>
                )}
                <button onClick={() => eliminar(idea)} aria-label="Eliminar" className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">×</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
