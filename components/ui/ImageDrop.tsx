'use client';

import { useRef, useState } from 'react';
import { toast } from '@/components/ui/Toaster';
import { openLightbox } from '@/components/ui/Lightbox';
import type { Foto } from '@/lib/diseno/fotos';

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
// permiten navegar un conjunto (ej. todas las fotos de un moodboard); el set puede
// traer descripciones, que el lightbox muestra al pie.
export function Thumbnail({ src, size = 36, className = '', alt = '', set, index = 0 }: { src?: string | null; size?: number; className?: string; alt?: string; set?: (string | Foto)[]; index?: number }) {
  const style = { width: size, height: size };
  if (!src) return <div style={style} className={`rounded-md bg-stone-100 border border-stone-200 shrink-0 ${className}`} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} style={style} title={alt || undefined}
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

// Una celda de la grilla: miniatura + su descripción. El texto se edita en un buffer
// local y se confirma al salir del campo (onBlur), porque los consumidores guardan en
// el servidor en cada onChange y no queremos un PUT por tecla.
function CeldaFoto({ foto, set, index, onDescripcion, onQuitar }: {
  foto: Foto; set: Foto[]; index: number; onDescripcion: (texto: string) => void; onQuitar: () => void;
}) {
  // Sin efecto de resincronización a propósito: la grilla le pasa `key={url-index}`,
  // así que si se quita una foto y los índices se corren, la celda se remonta sola.
  const [texto, setTexto] = useState(foto.descripcion ?? '');

  const confirmar = () => {
    const limpio = texto.trim();
    if (limpio !== (foto.descripcion ?? '')) onDescripcion(limpio);
  };

  return (
    <div className="w-20">
      <div className="relative group">
        <Thumbnail src={foto.url} size={80} alt={foto.descripcion ?? ''} set={set} index={index} />
        <button type="button" onClick={onQuitar} aria-label="Quitar foto"
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-stone-300 text-stone-500 hover:text-red-500 hover:border-red-300 text-xs leading-none shadow-sm flex items-center justify-center transition">×</button>
      </div>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
        placeholder="descripción…"
        title={texto || 'Qué te gusta (o no) de esta foto'}
        className="mt-1 w-full px-1.5 py-1 text-[11px] leading-tight border border-stone-200 rounded-md text-stone-700 placeholder:text-stone-300 focus:outline-none focus:border-violet-400"
      />
    </div>
  );
}

// Grilla multi-imagen para armar un moodboard: arrastrás VARIAS imágenes (o click),
// se suben a Blob y se agregan; cada una con su descripción y su quitar; además se
// puede pegar una URL. El formato es `Foto[]` — ver lib/diseno/fotos.ts.
export function MultiImageDrop({ value, onChange }: { value: Foto[]; onChange: (fotos: Foto[]) => void }) {
  const [subiendo, setSubiendo] = useState(0);
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const subirVarias = async (files: FileList | File[]) => {
    const arr = [...files].filter((f) => f.type.startsWith('image/'));
    if (!arr.length) return;
    setSubiendo((n) => n + arr.length);
    const urls = (await Promise.all(arr.map(subirImagen))).filter((u): u is string => !!u);
    setSubiendo((n) => Math.max(0, n - arr.length));
    if (urls.length) onChange([...value, ...urls.map((u) => ({ url: u, descripcion: null }))]);
  };

  const agregarUrl = () => {
    const u = url.trim();
    if (!u) return;
    onChange([...value, { url: u, descripcion: null }]);
    setUrl('');
  };

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 items-start">
          {value.map((f, i) => (
            <CeldaFoto
              key={`${f.url}-${i}`}
              foto={f}
              set={value}
              index={i}
              onDescripcion={(texto) => onChange(value.map((x, j) => j === i ? { ...x, descripcion: texto || null } : x))}
              onQuitar={() => onChange(value.filter((_, j) => j !== i))}
            />
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
