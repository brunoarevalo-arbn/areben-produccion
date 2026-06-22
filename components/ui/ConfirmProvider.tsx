'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from './Button';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

// Reemplazo de window.confirm() con un modal propio (on-brand).
// Uso en cualquier handler async: if (!(await confirmAsync('¿Borrar?'))) return;
// El host (<ConfirmHost/>) se monta una vez en el layout raíz. Si por algún
// motivo no está montado, cae a window.confirm() para NUNCA saltear la confirmación.
let externalShow: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;

export function confirmAsync(opts: ConfirmOptions | string): Promise<boolean> {
  const options = typeof opts === 'string' ? { message: opts } : opts;
  if (!externalShow) {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(options.message) : false);
  }
  return externalShow(options);
}

export function ConfirmHost() {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  useEffect(() => {
    externalShow = (opts) => {
      setState(opts);
      return new Promise<boolean>((resolve) => { resolver.current = resolve; });
    };
    return () => { externalShow = null; };
  }, []);

  const close = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  };

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state]);

  if (!state) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
      onClick={() => close(false)}>
      <div role="dialog" aria-modal="true"
        className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        {state.title && <h2 className="text-base font-bold text-stone-900 mb-2">{state.title}</h2>}
        <p className="text-sm text-stone-600 mb-5 whitespace-pre-line">{state.message}</p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => close(false)}>
            {state.cancelLabel ?? 'Cancelar'}
          </Button>
          <Button variant={state.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
            {state.confirmLabel ?? 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
