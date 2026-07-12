'use client';

import { useState, useEffect, useCallback } from 'react';

// Preview grande de imágenes, imperativo (mismo patrón que Toaster/Confirm):
//   openLightbox([url1, url2, ...], startIndex)
// El host (<LightboxHost/>) se monta una vez en el layout raíz.
let externalOpen: ((urls: string[], start: number) => void) | null = null;

export function openLightbox(urls: string[], startIndex = 0) {
  const limpias = (urls || []).filter(Boolean);
  if (!limpias.length || !externalOpen) return;
  externalOpen(limpias, Math.max(0, Math.min(startIndex, limpias.length - 1)));
}

export function LightboxHost() {
  const [urls, setUrls] = useState<string[] | null>(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    externalOpen = (u, start) => { setUrls(u); setI(start); };
    return () => { externalOpen = null; };
  }, []);

  const cerrar = useCallback(() => setUrls(null), []);
  const prev = useCallback(() => setI((n) => (urls ? (n - 1 + urls.length) % urls.length : 0)), [urls]);
  const next = useCallback(() => setI((n) => (urls ? (n + 1) % urls.length : 0)), [urls]);

  useEffect(() => {
    if (!urls) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [urls, cerrar, prev, next]);

  if (!urls) return null;
  const varias = urls.length > 1;

  return (
    <div onClick={cerrar} className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4 md:p-10 cursor-zoom-out print:hidden">
      <button onClick={cerrar} aria-label="Cerrar" className="absolute top-3 right-4 text-white/80 hover:text-white text-3xl leading-none">×</button>
      {varias && (
        <>
          <button onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Anterior"
            className="absolute left-3 md:left-6 text-white/70 hover:text-white text-4xl leading-none px-2">‹</button>
          <button onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Siguiente"
            className="absolute right-3 md:right-6 text-white/70 hover:text-white text-4xl leading-none px-2">›</button>
          <span className="absolute bottom-4 text-white/70 text-xs">{i + 1} / {urls.length}</span>
        </>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={urls[i]} alt="" onClick={(e) => e.stopPropagation()} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl cursor-default" />
    </div>
  );
}
