'use client';

import { useCallback, useEffect, useState } from 'react';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from '@/components/ui/Toaster';
import { confirmAsync } from '@/components/ui/ConfirmProvider';

interface Proceso {
  id: string; tipoPrenda: string; version: number; vigente: boolean;
  aprobadoPor: string | null; aprobadoAt: string | null; notas: string | null;
  pasos: { id: string; orden: number; nombre: string; maquina: string }[];
}

export function ProcesosClient() {
  const [loading, setLoading] = useState(true);
  const [procesos, setProcesos] = useState<Proceso[]>([]);

  const cargar = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/calculadora/procesos');
    if (r.ok) setProcesos(await r.json());
    setLoading(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const activar = async (p: Proceso) => {
    const ok = await confirmAsync({
      message: `¿Volver a la v${p.version} de ${p.tipoPrenda}? Las corridas nuevas van a nacer con esos pasos. Las ya medidas no se tocan.`,
      confirmLabel: 'Poner vigente',
    });
    if (!ok) return;
    const r = await fetch(`/api/calculadora/procesos/${p.id}`, { method: 'PATCH' });
    if (r.ok) { toast.success(`v${p.version} vigente`); cargar(); } else toast.error('No se pudo');
  };

  if (loading) return <LoadingState />;
  if (procesos.length === 0) {
    return (
      <EmptyState icon="🧵" title="Todavía no hay ningún proceso"
        message="Los procesos no se escriben de memoria: encendé una corrida de una prenda nueva, la costurera declara los pasos mientras cose, y al terminar aprobás esa secuencia acá." />
    );
  }

  const porPrenda = [...new Set(procesos.map((p) => p.tipoPrenda))];

  return (
    <div className="space-y-6">
      {porPrenda.map((prenda) => (
        <div key={prenda}>
          <h2 className="text-sm font-bold uppercase tracking-widest text-stone-400 mb-2">{prenda}</h2>
          <div className="space-y-2">
            {procesos.filter((p) => p.tipoPrenda === prenda).map((p) => (
              <div key={p.id} className={`bg-white border rounded-2xl p-5 ${p.vigente ? 'border-amber-300' : 'border-stone-200'}`}>
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-900">v{p.version}</span>
                    {p.vigente
                      ? <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800">Vigente</span>
                      : <button onClick={() => activar(p)} className="text-xs text-stone-400 hover:text-amber-600 underline">poner vigente</button>}
                    <span className="text-xs text-stone-400">{p.pasos.length} pasos</span>
                  </div>
                  <span className="text-xs text-stone-400">
                    {p.aprobadoPor ? `aprobado por ${p.aprobadoPor}` : ''}
                    {p.aprobadoAt ? ` · ${new Date(p.aprobadoAt).toLocaleDateString('es-AR')}` : ''}
                  </span>
                </div>
                <ol className="text-sm text-stone-600 space-y-0.5">
                  {p.pasos.map((x) => (
                    <li key={x.id}>{x.orden}. {x.nombre} <span className="text-stone-400">· {x.maquina}</span></li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
