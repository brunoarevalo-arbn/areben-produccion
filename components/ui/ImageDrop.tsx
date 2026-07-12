'use client';

import { useRef, useState } from 'react';
import { toast } from '@/components/ui/Toaster';
import { openLightbox } from '@/components/ui/Lightbox';

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

// Miniatura reutilizable (o placeholder gris si no hay imagen). Centraliza el <img>
// crudo y, si tiene imagen, abre el lightbox al click (preview grande). `set`/`index`
// permiten navegar un conjunto (ej. todas las fotos de un moodboard).
export function Thumbnail({ src, size = 36, className = '', set, index = 0 }: { src?: string | null; size?: number; className?: string; set?: string[]; index?: number }) {
  const style = { width: size, height: size };
  if (!src) return <div style={style} className={`rounded-md bg-stone-100 border border-stone-200 shrink-0 ${className}`} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" style={style}
      onClick={(e) => { e.stopPropagation(); openLightbox(set && set.length ? set : [src], set && set.length ? index : 0); }}
      className={`rounded-md object-cover border border-stone-200 shrink-0 cursor-zoom-in ${className}`} />
  );
}

// Sube un archivo de imagen a Blob y devuelve la URL (o null si falla). Reusado por
// los componentes de subida.
async function subirImagen(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/')) { toast.error(`"${file.name}" no es una imagen`); return null; }
  const fd = new FormData();
  fd.append('archivo', file);
  const r = await fetch('/api/upload-imagen', { method: 'POST', body: fd });
  if (r.ok) return (await r.json()).url as string;
  const d = await r.json().catch(() => ({}));
  toast.error(d.error || `No se pudo subir "${file.name}"`);
  return null;
}

// Grilla multi-imagen para armar un moodboard: arrastrás VARIAS imágenes (o click),
// se suben a Blob y se agregan; cada una con quitar; además se puede pegar una URL.
export function MultiImageDrop({ value, onChange }: { value: string[]; onChange: (urls: string[]) => void }) {
  const [subiendo, setSubiendo] = useState(0);
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const subirVarias = async (files: FileList | File[]) => {
    const arr = [...files].filter((f) => f.type.startsWith('image/'));
    if (!arr.length) return;
    setSubiendo((n) => n + arr.length);
    const urls = (await Promise.all(arr.map(subirImagen))).filter((u): u is string => !!u);
    setSubiendo((n) => Math.max(0, n - arr.length));
    if (urls.length) onChange([...value, ...urls]);
  };

  const agregarUrl = () => {
    const u = url.trim();
    if (!u) return;
    onChange([...value, u]);
    setUrl('');
  };

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((u, i) => (
            <div key={`${u}-${i}`} className="relative group">
              <Thumbnail src={u} size={80} set={value} index={i} />
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-stone-300 text-stone-500 hover:text-red-500 hover:border-red-300 text-xs leading-none shadow-sm flex items-center justify-center transition">×</button>
            </div>
          ))}
        </div>
      )}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) subirVarias(e.dataTransfer.files); }}
        className="rounded-xl border-2 border-dashed border-stone-300 hover:border-violet-400 bg-stone-50 py-6 text-center cursor-pointer transition text-xs text-stone-400"
      >
        {subiendo > 0 ? `Subiendo ${subiendo}…` : 'Arrastrá imágenes acá o hacé click'}
      </div>
      <div className="flex gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarUrl(); } }}
          placeholder="…o pegá el link de una imagen" className="flex-1 px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400" />
        <button type="button" onClick={agregarUrl} className="px-3 py-2 rounded-xl border border-stone-200 text-stone-600 hover:border-stone-400 text-sm transition">＋</button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { if (e.target.files?.length) subirVarias(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

// Miniatura chica que ADEMÁS sube: click o drag & drop sobre el cuadradito → sube a
// Blob y llama onUploaded(url). Sirve para cargar la foto directo desde una fila.
export function ThumbUpload({ src, size = 40, onUploaded }: { src?: string | null; size?: number; onUploaded: (url: string) => void | Promise<void> }) {
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const style = { width: size, height: size };

  const subir = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Elegí una imagen'); return; }
    setSubiendo(true);
    const fd = new FormData();
    fd.append('archivo', file);
    const r = await fetch('/api/upload-imagen', { method: 'POST', body: fd });
    if (r.ok) { const d = await r.json(); await onUploaded(d.url); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo subir la imagen'); }
    setSubiendo(false);
  };

  return (
    <div style={style} className="relative shrink-0 group"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files?.[0]; if (f) subir(f); }}>
      {src ? (
        <>
          {/* Click en la imagen → preview grande; el ＋ sube/reemplaza. */}
          <Thumbnail src={src} size={size} />
          <button type="button" title="Cambiar foto" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-stone-300 text-stone-500 hover:text-amber-600 text-xs leading-none shadow-sm flex items-center justify-center">＋</button>
        </>
      ) : (
        <div style={style} title="Cargar foto" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
          className="rounded-md bg-stone-100 border border-dashed border-stone-300 hover:border-amber-400 flex items-center justify-center text-stone-400 text-lg leading-none cursor-pointer">+</div>
      )}
      {subiendo && <div className="absolute inset-0 rounded-md bg-white/70 flex items-center justify-center text-[9px] text-stone-600">…</div>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ''; }} />
    </div>
  );
}
