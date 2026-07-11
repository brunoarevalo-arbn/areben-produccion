'use client';

import { useRef, useState } from 'react';
import { toast } from '@/components/ui/Toaster';

// Cuadrado para cargar una imagen: drag & drop o click, con preview y subida a
// Vercel Blob (/api/upload-imagen). onChange recibe la URL pública (o null).
export function ImageDrop({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const [subiendo, setSubiendo] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const src = preview ?? value;

  const subir = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Elegí una imagen'); return; }
    const local = URL.createObjectURL(file);
    setPreview(local);
    setSubiendo(true);
    const fd = new FormData();
    fd.append('archivo', file);
    const r = await fetch('/api/upload-imagen', { method: 'POST', body: fd });
    setSubiendo(false);
    URL.revokeObjectURL(local);
    setPreview(null);
    if (r.ok) { const d = await r.json(); onChange(d.url); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo subir la imagen'); }
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) subir(f); }}
        className="relative w-36 h-36 rounded-xl border-2 border-dashed border-stone-300 hover:border-amber-400 bg-stone-50 flex items-center justify-center cursor-pointer overflow-hidden transition"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="estampa" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[11px] text-stone-400 text-center px-2 leading-tight">Arrastrá una imagen<br />o hacé click</span>
        )}
        {subiendo && <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-xs font-medium text-stone-600">Subiendo…</div>}
      </div>
      {value && !subiendo && (
        <button type="button" onClick={() => onChange(null)} className="mt-1 text-xs text-stone-400 hover:text-red-500">✕ quitar imagen</button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ''; }} />
    </div>
  );
}

// Miniatura reutilizable (o placeholder gris si no hay imagen). Centraliza el <img> crudo.
export function Thumbnail({ src, size = 36, className = '' }: { src?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size };
  if (!src) return <div style={style} className={`rounded-md bg-stone-100 border border-stone-200 shrink-0 ${className}`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" style={style} className={`rounded-md object-cover border border-stone-200 shrink-0 ${className}`} />;
}
