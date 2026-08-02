'use client';

import { useEffect } from 'react';
import { RetiroTelaForm } from './RetiroTelaForm';

/**
 * Modal para retirar tela desde el rollo que ya estás mirando (ficha o listado),
 * sin pasar por la pantalla de retiros ni volver a buscar el rollo.
 */
export function RetiroTelaModal({
  rolloId,
  codigo,
  onClose,
  onRegistrado,
}: {
  rolloId: string;
  codigo: string;
  onClose: () => void;
  onRegistrado?: () => void;
}) {
  // Escape cierra, y el fondo no scrollea mientras el modal está abierto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-stone-900/40" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={`Retirar tela del rollo ${codigo}`}
        className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl border border-stone-200 shadow-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-stone-800">Retirar tela para muestra</h3>
            <p className="text-xs text-stone-400 mt-0.5">Se descuenta del rollo {codigo}.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar"
            className="text-stone-400 hover:text-stone-600 text-lg leading-none px-1">×</button>
        </div>

        <RetiroTelaForm rolloIdFijo={rolloId} autoFocus onRegistrado={() => { onRegistrado?.(); onClose(); }} />
      </div>
    </div>
  );
}
