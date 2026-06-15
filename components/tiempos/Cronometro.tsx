'use client';

interface CronometroProps {
  tiempoDisplay: string;
  activo: boolean;
  /** Detenido con un tramo medido todavía sin guardar (pendiente de guardar). */
  pendiente: boolean;
  onIniciar: () => void;
  onDetener: () => void;
}

export function Cronometro({ tiempoDisplay, activo, pendiente, onIniciar, onDetener }: CronometroProps) {
  const color = activo ? '#fbbf24' : pendiente ? '#34d399' : '#e7e5e4';
  return (
    <div className="bg-stone-900 rounded-xl px-4 py-3 flex items-center gap-4 shadow-lg">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {activo && <span className="text-amber-400 text-xs animate-pulse shrink-0">●</span>}
        <span className="font-mono text-2xl font-bold tracking-wider shrink-0" style={{ color }}>
          {tiempoDisplay}
        </span>
        {activo    && <span className="text-amber-500 text-xs">Registrando...</span>}
        {!activo && pendiente && (
          <span className="text-emerald-400 text-xs font-semibold leading-tight">Detenido · guardá el registro ↓</span>
        )}
        {!activo && !pendiente && <span className="text-stone-500 text-xs uppercase tracking-widest">Detenido</span>}
      </div>

      {activo ? (
        <button
          onClick={onDetener}
          className="bg-red-500 hover:bg-red-400 text-white px-5 py-2 rounded-lg font-bold text-sm transition-all active:scale-95 shrink-0"
        >
          ⏹ Detener
        </button>
      ) : (
        <button
          onClick={onIniciar}
          className={`px-5 py-2 rounded-lg font-bold text-sm transition-all active:scale-95 shrink-0 ${
            pendiente
              ? 'bg-stone-700 hover:bg-stone-600 text-stone-200'
              : 'bg-amber-400 hover:bg-amber-300 text-stone-900'
          }`}
        >
          {pendiente ? '▶ Empezar otro' : '▶ Iniciar'}
        </button>
      )}
    </div>
  );
}
