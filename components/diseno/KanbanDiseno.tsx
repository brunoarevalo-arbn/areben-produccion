'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KANBAN_COLUMNAS, ESTADO_LABEL, type EstadoProyecto } from '@/lib/diseno/estado';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

interface ProyectoItem {
  id:          string;
  nombre:      string;
  marca:       string;
  inspiracion: string | null;
  moodboard:   string | null;
  archivado:   boolean;
  updatedAt:   string;
  estado:      EstadoProyecto;
  faseActual:  string | null;
}

const COLUMNA_COLOR: Record<EstadoProyecto, { header: string; body: string }> = {
  inspiracion: { header: 'bg-violet-100  text-violet-800',  body: 'bg-violet-50/40'  },
  muestra:     { header: 'bg-amber-100   text-amber-800',   body: 'bg-amber-50/40'   },
  aprobado:    { header: 'bg-sky-100     text-sky-800',     body: 'bg-sky-50/40'     },
  produccion:  { header: 'bg-emerald-100 text-emerald-800', body: 'bg-emerald-50/40' },
  terminado:   { header: 'bg-stone-200   text-stone-700',   body: 'bg-stone-100'     },
  archivado:   { header: 'bg-stone-100   text-stone-500',   body: 'bg-stone-50'      },
};

export function KanbanDiseno({ proyectos }: { proyectos: ProyectoItem[] }) {
  const [mostrarArchivados, setMostrarArchivados] = useState(false);
  const [showNuevo,         setShowNuevo]         = useState(false);

  const activos     = proyectos.filter((p) => !p.archivado);
  const archivados  = proyectos.filter((p) =>  p.archivado);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Button onClick={() => setShowNuevo(true)}>+ Nuevo proyecto</Button>
        <button onClick={() => setMostrarArchivados((v) => !v)}
          className="text-xs text-stone-500 hover:text-stone-800 transition">
          {mostrarArchivados ? 'Ocultar archivados' : `Mostrar archivados (${archivados.length})`}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {KANBAN_COLUMNAS.map((estado) => {
          const items = activos.filter((p) => p.estado === estado);
          const c = COLUMNA_COLOR[estado];
          return (
            <div key={estado} className={`rounded-2xl border border-stone-200 ${c.body} flex flex-col min-h-[300px]`}>
              <div className={`px-3 py-2 rounded-t-2xl flex items-center justify-between ${c.header}`}>
                <span className="text-xs font-bold uppercase tracking-widest">{ESTADO_LABEL[estado]}</span>
                <span className="text-xs font-bold">{items.length}</span>
              </div>
              <div className="p-2 space-y-2 flex-1">
                {items.length === 0 && (
                  <p className="text-xs text-stone-300 italic px-2 py-3 text-center">—</p>
                )}
                {items.map((p) => <ProyectoCard key={p.id} proyecto={p} />)}
              </div>
            </div>
          );
        })}
      </div>

      {mostrarArchivados && archivados.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Archivados</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {archivados.map((p) => <ProyectoCard key={p.id} proyecto={p} />)}
          </div>
        </div>
      )}

      {showNuevo && <NuevoProyectoModal onClose={() => setShowNuevo(false)} />}
    </div>
  );
}

function ProyectoCard({ proyecto }: { proyecto: ProyectoItem }) {
  const router = useRouter();
  const fotoPreview = (() => {
    if (proyecto.moodboard) {
      try {
        const arr = JSON.parse(proyecto.moodboard);
        if (Array.isArray(arr) && arr.length > 0) return String(arr[0]);
      } catch { /* ignore */ }
    }
    return null;
  })();

  return (
    <button
      onClick={() => router.push(`/diseno/${proyecto.id}`)}
      className="w-full bg-white rounded-xl border border-stone-200 hover:border-violet-400 hover:shadow-sm transition text-left overflow-hidden block"
    >
      {fotoPreview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fotoPreview} alt="" className="w-full h-24 object-cover bg-stone-100" />
      )}
      <div className="p-2.5">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-semibold text-sm text-stone-800 leading-tight line-clamp-2">{proyecto.nombre}</p>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${proyecto.marca === 'Zattia' ? 'bg-violet-100 text-violet-700' : 'bg-pink-100 text-pink-700'}`}>
            {proyecto.marca}
          </span>
        </div>
        {proyecto.estado === 'produccion' && proyecto.faseActual && (
          <p className="text-xs text-emerald-700 font-medium mt-1">→ {proyecto.faseActual}</p>
        )}
      </div>
    </button>
  );
}

function NuevoProyectoModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [nombre,      setNombre]      = useState('');
  const [marca,       setMarca]       = useState<'Zattia' | 'Stunned'>('Zattia');
  const [inspiracion, setInspiracion] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [nombreError, setNombreError] = useState<string | null>(null);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { setNombreError('El nombre es obligatorio'); return; }
    setSaving(true); setError(null); setNombreError(null);
    const r = await fetch('/api/proyectos', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nombre: nombre.trim(), marca, inspiracion: inspiracion.trim() || undefined }),
    });
    if (r.ok) {
      const data = await r.json();
      router.push(`/diseno/${data.id}`);
    } else {
      const data = await r.json().catch(() => ({}));
      setError(typeof data.error === 'string' ? data.error : 'Error al crear');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-stone-900 mb-4">Nuevo proyecto</h2>
        <form onSubmit={crear} className="space-y-4">
          <Input
            label="Nombre *"
            value={nombre}
            onChange={(e) => { setNombre(e.target.value); if (nombreError) setNombreError(null); }}
            error={nombreError ?? undefined}
            autoFocus
            placeholder="Ej: Remera oversize verano 26"
            fullWidth
          />
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Marca</label>
            <div className="flex gap-2">
              {(['Zattia', 'Stunned'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMarca(m)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition ${
                    marca === m
                      ? m === 'Zattia' ? 'bg-violet-600 border-violet-600 text-white' : 'bg-pink-600 border-pink-600 text-white'
                      : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'
                  }`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            label="Inspiración / nota inicial"
            value={inspiracion}
            onChange={(e) => setInspiracion(e.target.value)}
            placeholder="Link de Pinterest, idea base, referencias…"
            rows={3}
            className="resize-none"
            fullWidth
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button type="submit" isLoading={saving} disabled={saving} className="flex-1">
              {saving ? 'Creando...' : 'Crear proyecto'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
