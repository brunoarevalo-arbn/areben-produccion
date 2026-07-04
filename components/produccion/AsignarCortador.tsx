'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/Toaster';

interface CortadorOpt { id: string; nombre: string; activo: boolean; usuarioId: string | null }

// Asigna un cortador a la OP para que la cargue desde su panel. Solo cuando la ficha
// todavía no está cargada.
export function AsignarCortador({ ordenId, cortadorId, corteEstado }: { ordenId: string; cortadorId: string | null; corteEstado: string | null }) {
  const router = useRouter();
  const [cortadores, setCortadores] = useState<CortadorOpt[]>([]);
  const [sel, setSel] = useState(cortadorId ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/cortadores').then((r) => r.ok ? r.json() : []).then((c: CortadorOpt[]) => setCortadores(c.filter((x) => x.activo))).catch(() => {});
  }, []);

  const asignar = async (id: string) => {
    setSel(id); setSaving(true);
    const r = await fetch(`/api/produccion/cola/${ordenId}/asignar-cortador`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cortadorId: id || null }),
    });
    if (r.ok) { toast.success(id ? 'Cortador asignado — lo verá en su panel' : 'Cortador desasignado'); router.refresh(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo asignar'); }
    setSaving(false);
  };

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-semibold text-stone-600">Cortador asignado:</label>
      <select value={sel} disabled={saving} onChange={(e) => asignar(e.target.value)}
        className="px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400">
        <option value="">— Ninguno —</option>
        {cortadores.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.usuarioId ? '' : ' (sin usuario)'}</option>)}
      </select>
      {corteEstado === 'cargado' && <span className="text-xs font-semibold text-blue-600">✓ ya cargó su corte</span>}
      {corteEstado === 'asignado' && <span className="text-xs text-amber-600">esperando que cargue</span>}
    </div>
  );
}
