'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from '@/components/ui/Toaster';

interface Solicitud {
  id: string;
  solicitadaPor: string;
  skuAnterior: string | null; maquinaAnterior: string | null;
  skuNuevo: string | null; maquinaNueva: string | null;
  usuario: string; actividad: string; fecha: string; minutos: number;
}

const val = (v: string | null) => v || '—';

export function SolicitudesCambioClient({ inicial }: { inicial: Solicitud[] }) {
  const [lista, setLista] = useState(inicial);
  const [procesando, setProcesando] = useState<string | null>(null);

  const resolver = async (id: string, accion: 'aprobar' | 'rechazar') => {
    setProcesando(id);
    const r = await fetch(`/api/tiempos/solicitudes/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion }),
    });
    if (r.ok) { setLista((p) => p.filter((s) => s.id !== id)); toast.success(accion === 'aprobar' ? 'Cambio aplicado' : 'Solicitud rechazada'); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo'); }
    setProcesando(null);
  };

  if (lista.length === 0) return <EmptyState title="Sin solicitudes pendientes" message="Cuando una costurera pida corregir un registro, aparece acá." />;

  return (
    <div className="space-y-3">
      {lista.map((s) => (
        <Card key={s.id} padding="none" className="p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-bold text-stone-800">{s.usuario}</p>
              <p className="text-xs text-stone-400">{s.actividad} · {s.fecha} · {s.minutos.toFixed(0)} min</p>
              <div className="mt-2 space-y-1 text-sm">
                {s.skuNuevo !== null && (
                  <p className="text-stone-700">SKU: <span className="font-mono text-stone-400 line-through">{val(s.skuAnterior)}</span> <span className="text-stone-400">→</span> <span className="font-mono font-semibold text-emerald-700">{val(s.skuNuevo)}</span></p>
                )}
                {s.maquinaNueva !== null && (
                  <p className="text-stone-700">Máquina: <span className="text-stone-400 line-through">{val(s.maquinaAnterior)}</span> <span className="text-stone-400">→</span> <span className="font-semibold text-emerald-700">{val(s.maquinaNueva)}</span></p>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="secondary" size="sm" onClick={() => resolver(s.id, 'rechazar')} disabled={procesando === s.id}>Rechazar</Button>
              <Button size="sm" onClick={() => resolver(s.id, 'aprobar')} isLoading={procesando === s.id}>Aprobar</Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
