'use client';

import type { EstadoCronometro } from '@/lib/hooks/useTiempos';

interface CronometroProps {
  tiempoDisplay: string;
  estado: EstadoCronometro;
  onIniciar: () => void;
  onPausar: () => void;
  onReanudar: () => void;
  onDescartar: () => void;
}

export function Cronometro({ tiempoDisplay, estado, onIniciar, onPausar, onReanudar, onDescartar }: CronometroProps) {
  const color = estado === 'corriendo' ? '#fbbf24' : estado === 'pausado' ? '#38bdf8' : '#e7e5e4';

  return (
    <div className="bg-stone-900 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {estado === 'corriendo' && <span className="text-amber-400 text-xs animate-pulse shrink-0">●</span>}
        <span className="font-mono text-2xl font-bold tracking-wider shrink-0" style={{ color }}>
          {tiempoDisplay}
        </span>
        {estado === 'corriendo' && <span className="text-amber-500 text-xs">Registrando...</span>}
        {estado === 'pausado'   && <span className="text-sky-400 text-xs font-semibold">En pausa</span>}
        {estado === 'idle'      && <span className="text-stone-500 text-xs uppercase tracking-widest">Detenido</span>}
      </div>

      {estado === 'idle' && (
        <button
          onClick={onIniciar}
          className="bg-amber-400 hover:bg-amber-300 text-stone-900 px-5 py-2 rounded-lg font-bold text-sm transition-all active:scale-95 shrink-0"
        >
          ▶ Iniciar
        </button>
      )}

      {estado === 'corriendo' && (
        <button
          onClick={onPausar}
          className="bg-sky-500 hover:bg-sky-400 text-white px-5 py-2 rounded-lg font-bold text-sm transition-all active:scale-95 shrink-0"
        >
          ⏸ Pausar
        </button>
      )}

      {estado === 'pausado' && (
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onDescartar}
            className="text-stone-400 hover:text-stone-200 text-xs px-2 py-2 transition"
          >
            Descartar
          </button>
          <button
            onClick={onReanudar}
            className="bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-2 rounded-lg font-bold text-sm transition-all active:scale-95"
          >
            ▶ Reanudar
          </button>
        </div>
      )}
    </div>
  );
}
