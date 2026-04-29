'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { ProyectoDiseno } from '@/types/diseno';

export function SeccionInspiracion({ proyecto }: { proyecto: ProyectoDiseno }) {
  const router    = useRouter();
  const inputRef  = useRef<HTMLInputElement>(null);
  const [editing,   setEditing]   = useState(false);
  const [texto,     setTexto]     = useState(proyecto.inspiracion ?? '');
  const [saving,    setSaving]    = useState(false);
  const [moodboard, setMoodboard] = useState<string[]>(proyecto.moodboard ?? []);
  const [uploading, setUploading] = useState(false);
  const [preview,   setPreview]   = useState<string | null>(null);

  const guardar = async () => {
    setSaving(true);
    await fetch(`/api/proyectos/${proyecto.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspiracion: texto }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  };

  const subirImagen = async (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setUploading(true);

    const form = new FormData();
    form.append('archivo', file);
    const res  = await fetch('/api/upload-imagen', { method: 'POST', body: form });
    const data = await res.json();

    const nuevas = [...moodboard, data.url];
    setMoodboard(nuevas);
    setPreview(null);

    await fetch(`/api/proyectos/${proyecto.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moodboard: nuevas }),
    });
    setUploading(false);
    router.refresh();
  };

  const eliminarImagen = async (idx: number) => {
    const nuevas = moodboard.filter((_, i) => i !== idx);
    setMoodboard(nuevas);
    await fetch(`/api/proyectos/${proyecto.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moodboard: nuevas }),
    });
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {/* Texto inspiración */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400">Inspiración & Referencias</h3>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-xs text-violet-600 hover:text-violet-800 font-medium">
              Editar
            </button>
          )}
        </div>

        {editing ? (
          <div>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={4}
              className="w-full border border-stone-200 rounded-xl p-3 text-sm text-stone-700 focus:outline-none focus:border-violet-400 resize-none"
              placeholder="Describí la inspiración, links a Pinterest, referencias de estilo, temporada..."
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={guardar}
                disabled={saving}
                className="bg-stone-900 text-white text-xs px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => { setEditing(false); setTexto(proyecto.inspiracion ?? ''); }} className="text-xs text-stone-500 px-4 py-2">
                Cancelar
              </button>
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
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50"
          >
            {uploading ? 'Subiendo...' : '+ Imagen'}
          </button>
        </div>

        {moodboard.length === 0 && !preview ? (
          <div
            className="border-2 border-dashed border-stone-200 rounded-xl p-10 text-center cursor-pointer hover:border-violet-300 transition"
            onClick={() => inputRef.current?.click()}
          >
            <p className="text-stone-400 text-sm">Subí imágenes de referencia para el mood board</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {moodboard.map((url, i) => (
              <div key={i} className="relative group aspect-square rounded-xl overflow-hidden bg-stone-100">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => eliminarImagen(i)}
                  className="absolute top-1 right-1 bg-stone-900/70 text-white text-xs w-6 h-6 rounded-full items-center justify-center hidden group-hover:flex"
                >
                  ×
                </button>
              </div>
            ))}
            {preview && (
              <div className="relative aspect-square rounded-xl overflow-hidden bg-stone-100 opacity-60">
                <img src={preview} alt="" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) subirImagen(f); if (inputRef.current) inputRef.current.value = ''; }}
        />
      </div>
    </div>
  );
}
