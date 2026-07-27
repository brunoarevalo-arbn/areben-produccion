'use client';

import { useState } from 'react';
import { APPS, APP_ACTUAL, linkDe } from '@/lib/apps-areben';

/**
 * "Nuestras apps": el salto a los otros sistemas internos, en el pie del sidebar.
 *
 * Se listan las cinco a todo el mundo, incluso las que la persona no usa: el
 * criterio es que todos sepan qué herramientas existen — si alguien necesita una,
 * la pide, en vez de no enterarse de que está. Quien no tenga acceso ve el mensaje
 * de "tu cuenta no tiene acceso a este sistema", que las tres apps ya dan.
 */
export function NuestrasApps({ onNavegar }: { onNavegar?: () => void }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 transition text-left"
      >
        <span className="flex-1">Nuestras apps</span>
        <span className="text-stone-500">{abierto ? '▾' : '▸'}</span>
      </button>

      {abierto && (
        <ul className="mt-1 space-y-0.5">
          {APPS.map((app) => (
            <li key={app.id}>
              {app.id === APP_ACTUAL ? (
                <div className="px-3 py-2 rounded-lg bg-stone-800/60" aria-current="page">
                  <span className="block text-xs font-medium text-stone-300">
                    {app.nombre} <span className="text-stone-500 font-normal">· estás acá</span>
                  </span>
                  <span className="block text-[11px] text-stone-500 leading-snug">
                    {app.descripcion}
                  </span>
                </div>
              ) : (
                <a
                  href={linkDe(app)}
                  onClick={onNavegar}
                  className="block px-3 py-2 rounded-lg hover:bg-stone-800/60 transition group"
                >
                  <span className="block text-xs font-medium text-stone-300 group-hover:text-amber-400">
                    {app.nombre}
                  </span>
                  <span className="block text-[11px] text-stone-500 leading-snug">
                    {app.descripcion}
                  </span>
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
