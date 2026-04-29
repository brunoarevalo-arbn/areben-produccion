'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { ProyectoDiseno, IdeaDiseno } from '@/types/diseno';

function IdeaCard({
  idea,
  proyectoId,
  onRefresh,
}: {
  idea: IdeaDiseno;
  proyectoId: string;
  onRefresh: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);

  const eliminar = async () => {
    await fetch(`/api/proyectos/${proyectoId}/ideas/${idea.id}`, { method: 'DELETE' });
    onRefresh();
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden group">
      {idea.foto && (
        <div className="aspect-video overflow-hidden bg-stone-100">
          <img src={idea.foto} alt={idea.titulo ?? ''} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4 space-y-2">
        {idea.titulo && (
          <h4 className="font-semibold text-stone-900 text-sm">{idea.titulo}</h4>
        )}
        <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{idea.descripcion}</p>
        {idea.etiquetas.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {idea.etiquetas.map((et, i) => (
              <span key={i} className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-medium">
                {et}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-stone-400">
            {new Date(idea.createdAt).toLocaleDateString('es-AR')}
          </span>
          {confirmando ? (
            <div className="flex gap-2 items-center">
              <span className="text-xs text-stone-500">¿Eliminar?</span>
              <button onClick={eliminar} className="text-xs text-red-600 font-semibold hover:text-red-800">Sí</button>
              <button onClick={() => setConfirmando(false)} className="text-xs text-stone-400 hover:text-stone-600">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmando(true)} className="text-xs text-stone-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100">
              Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SeccionIdeas({ proyecto }: { proyecto: ProyectoDiseno }) {
  const router    = useRouter();
  const inputRef  = useRef<HTMLInputElement>(null);
  const [open,      setOpen]      = useState(false);
  const [titulo,    setTitulo]    = useState('');
  const [desc,      setDesc]      = useState('');
  const [etiquetas, setEtiquetas] = useState('');
  const [fotoUrl,   setFotoUrl]   = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);

  const subirFoto = async (file: File) => {
    setUploading(true);
    const form = new FormData();
    form.append('archivo', file);
    const res  = await fetch('/api/upload-imagen', { method: 'POST', body: form });
    const data = await res.json();
    setFotoUrl(data.url);
    setUploading(false);
  };

  const guardar = async () => {
    if (!desc.trim()) return;
    setSaving(true);
    const tags = etiquetas.split(',').map((t) => t.trim()).filter(Boolean);
    await fetch(`/api/proyectos/${proyecto.id}/ideas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo:      titulo.trim()  || undefined,
        descripcion: desc.trim(),
        foto:        fotoUrl        || undefined,
        etiquetas:   tags,
      }),
    });
    setTitulo(''); setDesc(''); setEtiquetas(''); setFotoUrl(''); setOpen(false);
    setSaving(false);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400">
          {proyecto.ideas.length === 0 ? 'Sin ideas todavía' : `${proyecto.ideas.length} idea${proyecto.ideas.length > 1 ? 's' : ''}`}
        </h3>
        <button
          onClick={() => setOpen((v) => !v)}
          className="bg-stone-900 hover:bg-stone-800 text-white text-xs px-4 py-2 rounded-lg font-semibold transition"
        >
          {open ? 'Cancelar' : '+ Nueva idea'}
        </button>
      </div>

      {/* Formulario nueva idea */}
      {open && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Nueva idea</p>

          <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (opcional)" className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400" />

          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Descripción de la idea, referencia, link..." className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-violet-400" />

          <input type="text" value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} placeholder="Etiquetas (separadas por coma, ej: color, silueta)" className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400" />

          {/* Foto */}
          <div>
            {fotoUrl ? (
              <div className="relative inline-block">
                <img src={fotoUrl} alt="" className="w-32 h-32 object-cover rounded-xl" />
                <button onClick={() => setFotoUrl('')} className="absolute -top-1.5 -right-1.5 bg-stone-900 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">×</button>
              </div>
            ) : (
              <button onClick={() => inputRef.current?.click()} disabled={uploading} className="border-2 border-dashed border-stone-200 hover:border-violet-400 rounded-xl px-4 py-3 text-xs text-stone-400 hover:text-violet-500 transition disabled:opacity-50">
                {uploading ? 'Subiendo...' : '+ Adjuntar imagen'}
              </button>
            )}
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) subirFoto(f); if (inputRef.current) inputRef.current.value = ''; }} />
          </div>

          <div className="flex gap-2">
            <button onClick={guardar} disabled={saving || !desc.trim()} className="bg-stone-900 text-white text-sm px-5 py-2.5 rounded-xl font-semibold disabled:opacity-40">
              {saving ? 'Guardando...' : 'Guardar idea'}
            </button>
            <button onClick={() => setOpen(false)} className="text-sm text-stone-500 px-4 py-2.5">Cancelar</button>
          </div>
        </div>
      )}

      {proyecto.ideas.length === 0 && !open && (
        <div className="border-2 border-dashed border-stone-200 rounded-2xl p-10 text-center">
          <p className="text-stone-400 text-sm">Guardá referencias, bocetos e ideas para este diseño.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {proyecto.ideas.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} proyectoId={proyecto.id} onRefresh={() => router.refresh()} />
        ))}
      </div>
    </div>
  );
}
