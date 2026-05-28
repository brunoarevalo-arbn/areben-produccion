'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CorteRevertir({ ordenId }: { ordenId: string }) {
  const router = useRouter();
  const [revertiendo, setRevertiendo] = useState(false);

  const revertir = async () => {
    if (!confirm('Esto revierte el corte: devuelve los rollos y lotes al stock, borra el desglose por talle y vuelve la OP a PENDIENTE. Despues vas a poder cargar el corte de nuevo. Continuar?')) return;
    setRevertiendo(true);
    const r = await fetch(`/api/produccion/cola/${ordenId}/corte/revertir`, { method: 'POST' });
    if (r.ok) {
      router.refresh();
    } else {
      const d = await r.json();
      alert(d.error || 'Error al revertir');
      setRevertiendo(false);
    }
  };

  return (
    <button onClick={revertir} disabled={revertiendo}
      className="px-4 py-2.5 rounded-xl text-sm border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition">
      {revertiendo ? 'Revirtiendo...' : 'Revertir y editar'}
    </button>
  );
}
