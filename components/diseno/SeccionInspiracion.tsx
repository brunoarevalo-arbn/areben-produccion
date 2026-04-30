'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { ProyectoDiseno, IdeaDiseno } from '@/types/diseno';

function IdeaCard({ idea, proyectoId, onRefresh }: { idea: IdeaDiseno; proyectoId: string; onRefresh: () => void }) {
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
        {idea.titulo && <h4 className="font-semibold text-stone-900 text-sm">{idea.titulo}</h4>}
        <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{idea.descripcion}</p>
        {idea.etiquetas.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {idea.etiquetas.map((et, i) => (
              <span key={i} className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-medium">{et}</span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-stone-400">{new Date(idea.createdAt).toLocaleDateString('es-AR')}</span>
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

export function SeccionInspiracion({ proyecto }: { proyecto: ProyectoDiseno }) {
  const router    = useRouter();
  const moodRef   = useRef<HTMLInputElement>(null);
  const ideaRef   = useRef<HTMLInputElement>(null);

  // Inspiración
  const [editing,   setEditing]   = useState(false);
  const [texto,     setTexto]     = useState(proyecto.inspiracion ?? '');
  const [saving,    setSaving]    = useState(false);
  const [moodboard, setMoodboard] = useState<string[]>(proyecto.moodboard ?? []);
  const [uploading, setUploading] = useState(false);
  const [preview,   setPreview]   = useState<string | null>(null);

  // Ideas
  const [openIdea,   setOpenIdea]   = useState(false);
  const [titulo,     setTitulo]     = useState('');
  const [desc,       setDesc]       = useState('');
  const [etiquetas,  setEtiquetas]  = useState('');
  const [fotoUrl,    setFotoUrl]    = useState('');
  const [upIdea,     setUpIdea]     = useState(false);
  const [savingIdea, setSavingIdea] = useState(false);

  const guardarInspiracion = async () => {
    setSaving(true);
    await fetch(`/api/proyectos/${proyecto.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspiracion: texto }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  };

  const subirMoodboard = async (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setUploading(true);
    const form = new FormData(); form.append('archivo', file);
    const res  = await fetch('/api/upload-imagen', { method: 'POST', body: form });
    const data = await res.json();
    const nuevas = [...moodboard, data.url];
    setMoodboard(nuevas); setPreview(null);
    await fetch(`/api/proyectos/${proyecto.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moodboard: nuevas }),
    });
    setUploading(false);
    router.refresh();
  };

  const eliminarMoodboard = async (idx: number) => {
    const nuevas = moodboard.filter((_, i) => i !== idx);
    setMoodboard(nuevas);
    await fetch(`/api/proyectos/${proyecto.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moodboard: nuevas }),
    });
    router.refresh();
  };

  const subirFotoIdea = async (file: File) => {
    setUpIdea(true);
    const form = new FormData(); form.append('archivo', file);
    const res  = await fetch('/api/upload-imagen', { method: 'POST', body: form });
    const data = await res.json();
    setFotoUrl(data.url);
    setUpIdea(false);
  };

  const guardarIdea = async () => {
    if (!desc.trim()) return;
    setSavingIdea(true);
    const tags = etiquetas.split(',').map((t) => t.trim()).filter(Boolean);
    await fetch(`/api/proyectos/${proyecto.id}/ideas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: titulo.trim() || undefined, descripcion: desc.trim(), foto: fotoUrl || undefined, etiquetas: tags }),
    });
    setTitulo(''); setDesc(''); setEtiquetas(''); setFotoUrl(''); setOpenIdea(false);
    setSavingIdea(false);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {/* Texto inspiración */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400">Inspiración & Referencias</h3>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-xs text-violet-600 hover:text-violet-800 font-medium">Editar</button>
          )}
        </div>
        {editing ? (
          <div>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4}
              className="w-full border border-stone-200 rounded-xl p-3 text-sm text-stone-700 focus:outline-none focus:border-violet-400 resize-none"
              placeholder="Describí la inspiración, links a Pinterest, referencias de estilo, temporada..." />
            <div className="flex gap-2 mt-3">
              <button onClick={guardarInspiracion} disabled={saving} className="bg-stone-900 text-white text-xs px-4 py-2 rounded-lg font-semibold disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => { setEditing(false); setTexto(proyecto.inspiracion ?? ''); }} className="text-xs text-stone-500 px-4 py-2">Cancelar</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">
            {texto || <span className="text-stone-400 italic">Sin descripción. Hacé clic en Editar.</span>}
          </p>
        )}
      </div>

      {/* Mood Board */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400">Mood Board</h3>
          <button onClick={() => moodRef.current?.click()} disabled={uploading}
            className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50">
            {uploading ? 'Subiendo...' : '+ Imagen'}
          </button>
        </div>
        {moodboard.length === 0 && !preview ? (
          <div className="border-2 border-dashed border-stone-200 rounded-xl p-10 text-center cursor-pointer hover:border-violet-300 transition"
            onClick={() => moodRef.current?.click()}>
            <p className="text-stone-400 text-sm">Subí imágenes de referencia para el mood board</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {moodboard.map((url, i) => (
              <div key={i} className="relative group aspect-square rounded-xl overflow-hidden bg-stone-100">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button onClick={() => eliminarMoodboard(i)}
                  className="absolute top-1 right-1 bg-stone-900/70 text-white text-xs w-6 h-6 rounded-full items-center justify-center hidden group-hover:flex">×</button>
              </div>
            ))}
            {preview && (
              <div className="relative aspect-square rounded-xl overflow-hidden bg-stone-100 opacity-60">
                <img src={preview} alt="" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        )}
        <input ref={moodRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) subirMoodboard(f); if (moodRef.current) moodRef.current.value = ''; }} />
      </div>

      {/* Ideas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
            Ideas
            {proyecto.ideas.length > 0 && <span className="ml-2 font-normal text-stone-300 normal-case tracking-normal">{proyecto.ideas.length}</span>}
          </p>
          <button onClick={() => setOpenIdea((v) => !v)}
            className="bg-stone-900 hover:bg-stone-800 text-white text-xs px-4 py-2 rounded-lg font-semibold transition">
            {openIdea ? 'Cancelar' : '+ Nueva idea'}
          </button>
        </div>

        {openIdea && (
          <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 mb-4">
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título (opcional)" className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3}
              placeholder="Descripción de la idea, referencia, link..."
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-violet-400" />
            <input type="text" value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)}
              placeholder="Etiquetas separadas por coma (ej: color, silueta)"
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
            <div>
              {fotoUrl ? (
                <div className="relative inline-block">
                  <img src={fotoUrl} alt="" className="w-32 h-32 object-cover rounded-xl" />
                  <button onClick={() => setFotoUrl('')} className="absolute -top-1.5 -right-1.5 bg-stone-900 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">×</button>
                </div>
              ) : (
                <button onClick={() => ideaRef.current?.click()} disabled={upIdea}
                  className="border-2 border-dashed border-stone-200 hover:border-violet-400 rounded-xl px-4 py-3 text-xs text-stone-400 hover:text-violet-500 transition disabled:opacity-50">
                  {upIdea ? 'Subiendo...' : '+ Adjuntar imagen'}
                </button>
              )}
              <input ref={ideaRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) subirFotoIdea(f); if (ideaRef.current) ideaRef.current.value = ''; }} />
            </div>
            <div className="flex gap-2">
              <button onClick={guardarIdea} disabled={savingIdea || !desc.trim()}
                className="bg-stone-900 text-white text-sm px-5 py-2.5 rounded-xl font-semibold disabled:opacity-40">
                {savingIdea ? 'Guardando...' : 'Guardar idea'}
              </button>
              <button onClick={() => setOpenIdea(false)} className="text-sm text-stone-500 px-4 py-2.5">Cancelar</button>
            </div>
          </div>
        )}

        {proyecto.ideas.length === 0 && !openIdea ? (
          <div className="border-2 border-dashed border-stone-200 rounded-2xl p-8 text-center">
            <p className="text-stone-400 text-sm">Guardá referencias, bocetos e ideas para este diseño.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {proyecto.ideas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} proyectoId={proyecto.id} onRefresh={() => router.refresh()} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
