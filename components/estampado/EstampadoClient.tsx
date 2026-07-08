'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCronometro } from '@/lib/hooks/useCronometro';
import { Cronometro } from '@/components/tiempos/Cronometro';
import { NumInput } from '@/components/ui/NumInput';
import { toast } from '@/components/ui/Toaster';

interface Tanda { id: string; cantidad: number; minutosNetos: number; notas: string | null; horaInicio: string | null; horaFin: string | null; }

const fmtMin = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });

export function EstampadoClient({ usuario, esEstampador = true }: { usuario: string; esEstampador?: boolean }) {
  const router = useRouter();
  const crono = useCronometro(usuario, 'estampado');
  const [cantidad, setCantidad] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [tandas, setTandas] = useState<Tanda[]>([]);

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/estampado?usuario=${encodeURIComponent(usuario)}`);
    if (r.ok) setTandas(await r.json());
  }, [usuario]);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    const cant = parseInt(cantidad) || 0;
    if (cant <= 0) { toast.error('Cargá cuántas estampas hiciste'); return; }
    const t = crono.obtenerTiempos();
    if (!t) { toast.error('Iniciá el cronómetro primero'); return; }
    setSaving(true);
    const r = await fetch('/api/estampado', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cantidad: cant, minutosNetos: t.minutosNetos, horaInicio: t.horaInicio, horaFin: t.horaFin, notas: notas.trim() || undefined }),
    });
    if (r.ok) {
      const tanda = await r.json();
      setTandas((p) => [tanda, ...p]);
      crono.descartar(); setCantidad(''); setNotas('');
      toast.success('Tanda guardada');
    } else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo guardar'); }
    setSaving(false);
  };

  const salir = async () => {
    if (esEstampador) { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login'); }
    else { router.push('/estamperia'); }
  };

  const totalEst = tandas.reduce((s, t) => s + t.cantidad, 0);
  const totalMin = tandas.reduce((s, t) => s + t.minutosNetos, 0);
  const minPorEstampa = totalEst > 0 ? totalMin / totalEst : 0;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 p-4 md:p-6">
      <div className="max-w-2xl lg:max-w-5xl mx-auto flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-amber-400 text-xs font-bold uppercase tracking-widest">Estampado</p>
            <p className="text-stone-300 text-sm">{usuario}</p>
          </div>
          <button onClick={salir} className="text-xs text-stone-500 hover:text-stone-300">{esEstampador ? 'Salir' : '← Volver'}</button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          {/* Columna 1: cronómetro + cerrar tanda */}
          <div className="flex flex-col gap-4">
            <Cronometro
              tiempoDisplay={crono.tiempoDisplay}
              estado={crono.estado}
              onIniciar={crono.iniciar}
              onPausar={crono.pausar}
              onReanudar={crono.reanudar}
              onDescartar={crono.descartar}
            />

            <div className="bg-stone-900 rounded-xl p-4 space-y-3">
              <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Cerrar tanda</p>
              <div>
                <label className="text-xs text-stone-400 block mb-1">¿Cuántas estampas hiciste?</label>
                <NumInput value={parseInt(cantidad) || 0} onChange={(n) => setCantidad(n ? String(n) : '')} min="0"
                  className="w-full px-3 py-3 rounded-lg bg-stone-800 border border-stone-700 text-stone-100 text-lg focus:outline-none focus:border-amber-400" />
              </div>
              <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas (opcional)"
                className="w-full px-3 py-2 rounded-lg bg-stone-800 border border-stone-700 text-stone-100 text-sm focus:outline-none focus:border-amber-400" />
              <button onClick={guardar} disabled={saving}
                className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-stone-900 py-3 rounded-lg font-bold transition active:scale-95">
                {saving ? 'Guardando…' : '✓ Guardar tanda'}
              </button>
            </div>
          </div>

          {/* Columna 2: resumen + tandas del día */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-stone-900 rounded-xl p-3 text-center"><p className="text-[10px] text-stone-500 uppercase tracking-widest font-bold">Estampas</p><p className="text-lg font-bold tabular-nums">{totalEst}</p></div>
              <div className="bg-stone-900 rounded-xl p-3 text-center"><p className="text-[10px] text-stone-500 uppercase tracking-widest font-bold">Minutos</p><p className="text-lg font-bold tabular-nums">{fmtMin(totalMin)}</p></div>
              <div className="bg-amber-400/10 rounded-xl p-3 text-center"><p className="text-[10px] text-amber-500 uppercase tracking-widest font-bold">Min/estampa</p><p className="text-lg font-bold tabular-nums text-amber-400">{fmtMin(minPorEstampa)}</p></div>
            </div>

            <div className="bg-stone-900 rounded-xl divide-y divide-stone-800">
              {tandas.length === 0 ? (
                <p className="text-center text-sm text-stone-500 py-6">Sin tandas hoy.</p>
              ) : tandas.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="font-bold tabular-nums">{t.cantidad} est.</span>
                  <span className="text-stone-400 tabular-nums">{fmtMin(t.minutosNetos)} min</span>
                  <span className="text-amber-400 tabular-nums ml-auto">{fmtMin(t.cantidad > 0 ? t.minutosNetos / t.cantidad : 0)} min/est</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
