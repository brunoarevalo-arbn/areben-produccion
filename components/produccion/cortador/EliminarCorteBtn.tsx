'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { toast } from '@/components/ui/Toaster';

// Botón para que el cortador elimine su propia carga (corteEstado='cargado', sin
// validar por el taller). Limpia la ficha y deja el corte listo para recargar.
export function EliminarCorteBtn({ ordenId, sku }: { ordenId: string; sku: string }) {
  const router = useRouter();
  const [borrando, setBorrando] = useState(false);

  const eliminar = async () => {
    if (!(await confirmAsync({ message: `¿Eliminar el corte cargado de ${sku}? Vas a poder volver a cargarlo desde cero.`, danger: true, confirmLabel: 'Eliminar' }))) return;
    setBorrando(true);
    const r = await fetch(`/api/cortador/carga/${ordenId}`, { method: 'DELETE' });
    if (r.ok) { toast.success('Corte eliminado'); router.refresh(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo eliminar'); setBorrando(false); }
  };

  return (
    <button onClick={eliminar} disabled={borrando}
      className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 font-semibold transition">
      {borrando ? 'Eliminando…' : 'Eliminar'}
    </button>
  );
}
