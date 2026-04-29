'use client';

interface CronometroProps {
  tiempoDisplay: string;
  activo: boolean;
  onIniciar: () => void;
  onDetener: () => void;
}

export function Cronometro({ tiempoDisplay, activo, onIniciar, onDetener }: CronometroProps) {
  return (
    <div className="bg-stone-900 rounded-xl px-4 py-3 flex items-center gap-4 shadow-lg">
      <div className="flex items-center gap-3 flex-1">
        {activo && <span className="text-amber-400 text-xs animate-pulse shrink-0">●</span>}
        <span
          className="font-mono text-2xl font-bold tracking-wider"
          style={{ color: activo ? '#fbbf24' : '#e7e5e4' }}
        >
          {tiempoDisplay}
        </span>
        {!activo && <span className="text-stone-500 text-xs uppercase tracking-widest">Detenido</span>}
        {activo  && <span className="text-amber-500 text-xs">Registrando...</span>}
      </div>

      {!activo ? (
        <button
          onClick={onIniciar}
          className="bg-amber-400 hover:bg-amber-300 text-stone-900 px-5 py-2 rounded-lg font-bold text-sm transition-all active:scale-95 shrink-0"
        >
          ▶ Iniciar
        </button>
      ) : (
        <button
          onClick={onDetener}
          className="bg-red-500 hover:bg-red-400 text-white px-5 py-2 rounded-lg font-bold text-sm transition-all active:scale-95 shrink-0"
        >
          ⏹ Detener
        </button>
      )}
    </div>
  );
}
