'use client';

import { useState } from 'react';
import { TiemposProduccion } from '@/types/tiempos';
import { LoadingState } from '@/components/ui/LoadingState';
import { PedirCorreccionModal } from './PedirCorreccionModal';

interface OrdenCola { id: string; sku: string | null; marca: string }
interface LogRegistrosProps {
  registros: TiemposProduccion[];
  loading: boolean;
  ordenes?: OrdenCola[];
  pendientes?: Set<string>; // tiempoIds con solicitud pendiente
  onEnviada?: () => void;
}

const COLORES: Record<string, string> = {
  'Proceso Completado': 'border-emerald-400 bg-emerald-50',
  'Muestra/Prototipo':  'border-violet-400 bg-violet-50',
  'Descanso':           'border-sky-400 bg-sky-50',
  'Almuerzo':           'border-orange-400 bg-orange-50',
  'Falla Máquina':      'border-red-400 bg-red-50',
  'Cambio Hilo':        'border-yellow-400 bg-yellow-50',
};

const ICONOS: Record<string, string> = {
  'Proceso Completado': '✅',
  'Muestra/Prototipo':  '📐',
  'Descanso':           '☕',
  'Almuerzo':           '🍽️',
  'Falla Máquina':      '⚠️',
  'Cambio Hilo':        '🧵',
};

export function LogRegistros({ registros, loading, ordenes = [], pendientes, onEnviada }: LogRegistrosProps) {
  const [corrigiendo, setCorrigiendo] = useState<TiemposProduccion | null>(null);

  if (loading) {
    return <LoadingState label="Cargando registros…" />;
  }

  if (registros.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-stone-400">
        <span className="text-3xl mb-2">🧵</span>
        <p className="text-sm">Los registros del día aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {registros.map((reg) => {
        const colorClass = COLORES[reg.actividad] ?? 'border-stone-300 bg-stone-50';
        const icono      = ICONOS[reg.actividad] ?? '📋';

        return (
          <div key={reg.id} className={`rounded-xl border-l-4 p-3 shadow-sm ${colorClass}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg shrink-0">{icono}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-stone-800 text-sm truncate">{reg.actividad}</p>
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {reg.marca && (
                      <span className="text-xs bg-white/70 text-stone-600 px-1.5 py-0.5 rounded font-medium">{reg.marca}</span>
                    )}
                    {reg.sku && (
                      <span className="text-xs bg-white/70 text-stone-600 px-1.5 py-0.5 rounded font-mono">{reg.sku}</span>
                    )}
                    {reg.maquina && (
                      <span className="text-xs bg-white/70 text-stone-500 px-1.5 py-0.5 rounded">🔧 {reg.maquina}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                {reg.cantidad > 0 && (
                  <p className="text-sm font-bold text-stone-700">{reg.cantidad} pzas</p>
                )}
                {reg.defectos > 0 && (
                  <p className="text-xs font-bold text-red-600">{reg.defectos} def.</p>
                )}
                <p className="text-xs text-stone-500 mt-0.5">⏱ {reg.minutosNetos.toFixed(0)} min</p>
              </div>
            </div>

            {reg.horaInicio && (
              <p className="text-xs text-stone-400 mt-1.5 border-t border-white/60 pt-1.5">
                {reg.horaInicio} → {reg.horaFin}
              </p>
            )}

            {reg.inconveniente && (
              <div className="mt-2 bg-amber-100 border border-amber-300 rounded-lg px-2 py-1.5">
                <p className="text-xs font-bold text-amber-800">⚠ {reg.inconveniente}</p>
                {reg.inconvenienteNotas && (
                  <p className="text-xs text-amber-700 mt-0.5">{reg.inconvenienteNotas}</p>
                )}
              </div>
            )}

            {(reg.actividad === 'Proceso Completado' || reg.sku) && reg.id && (
              <div className="mt-1.5 flex justify-end">
                {pendientes?.has(reg.id) ? (
                  <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">⏳ cambio pendiente</span>
                ) : (
                  <button onClick={() => setCorrigiendo(reg)}
                    className="text-xs text-stone-500 hover:text-stone-800 border border-stone-300 hover:border-stone-400 px-2 py-0.5 rounded transition">
                    ✎ Pedir corrección
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {corrigiendo && (
        <PedirCorreccionModal
          registro={corrigiendo}
          ordenes={ordenes}
          onClose={() => setCorrigiendo(null)}
          onEnviada={() => onEnviada?.()}
        />
      )}
    </div>
  );
}
