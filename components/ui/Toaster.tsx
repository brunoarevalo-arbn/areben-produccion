'use client';

import { useState, useEffect } from 'react';

type ToastType = 'error' | 'success' | 'info';
interface ToastItem { id: number; message: string; type: ToastType; }

// Notificaciones on-brand (reemplazo de alert()). Uso: toast.error('No se pudo...').
// El host (<ToastHost/>) se monta una vez en el layout raíz; los toasts se
// auto-descartan a los 4s. Si el host no está montado, cae a console.
let externalPush: ((t: Omit<ToastItem, 'id'>) => void) | null = null;
let counter = 0;

function show(message: string, type: ToastType) {
  if (!externalPush) {
    if (typeof console !== 'undefined') console[type === 'error' ? 'error' : 'log'](message);
    return;
  }
  externalPush({ message, type });
}

export const toast = {
  error:   (m: string) => show(m, 'error'),
  success: (m: string) => show(m, 'success'),
  info:    (m: string) => show(m, 'info'),
};

const STYLES: Record<ToastType, string> = {
  error:   'bg-red-50 border-red-200 text-red-700',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  info:    'bg-stone-900 border-stone-700 text-white',
};

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    externalPush = (t) => {
      counter += 1;
      const id = counter;
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4000);
    };
    return () => { externalPush = null; };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 max-w-sm print:hidden">
      {toasts.map((t) => (
        <div key={t.id} role="status"
          className={`rounded-xl px-4 py-3 text-sm font-medium shadow-lg border ${STYLES[t.type]}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
