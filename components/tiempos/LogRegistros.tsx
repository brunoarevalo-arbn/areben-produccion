'use client';

import { TiemposProduccion } from '@/types/tiempos';

interface LogRegistrosProps {
  registros: TiemposProduccion[];
  loading: boolean;
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

export function LogRegistros({ registros, loading }: LogRegistrosProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-stone-400 text-sm">
        <span className="animate-pulse">Cargando registros...</span>
      </div>
    );
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
          </div>
        );
      })}
    </div>
  );
}
