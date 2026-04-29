'use client';

interface CronometroProps {
  tiempoDisplay: string;
  activo: boolean;
  onIniciar: () => void;
  onDetener: () => void;
}

export function Cronometro({ tiempoDisplay, activo, onIniciar, onDetener }: CronometroProps) {
  return (
    <div className="bg-stone-900 rounded-2xl p-6 text-center shadow-lg">
      <p className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-3">
        Tiempo en curso
      </p>

      <div
        className="font-mono text-5xl font-bold tracking-wider mb-6"
        style={{ color: activo ? '#fbbf24' : '#e7e5e4' }}
      >
        {tiempoDisplay}
      </div>

      {!activo ? (
        <button
          onClick={onIniciar}
          className="w-full bg-amber-400 hover:bg-amber-300 text-stone-900 py-3 rounded-xl font-bold text-base transition-all active:scale-95"
        >
          ▶ INICIAR
        </button>
      ) : (
        <button
          onClick={onDetener}
          className="w-full bg-red-500 hover:bg-red-400 text-white py-3 rounded-xl font-bold text-base transition-all active:scale-95"
        >
          ⏹ DETENER
        </button>
      )}

      {activo && (
        <p className="text-amber-400 text-xs mt-3 animate-pulse">● Registrando tiempo...</p>
      )}
    </div>
  );
}
