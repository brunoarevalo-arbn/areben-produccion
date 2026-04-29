import type { EstadoProyecto } from '@/types/diseno';

const PASOS: { id: EstadoProyecto; label: string; icon: string }[] = [
  { id: 'inspiracion',   label: 'Inspiración',  icon: '💡' },
  { id: 'en_desarrollo', label: 'Desarrollo',   icon: '📐' },
  { id: 'muestra_lista', label: 'Muestra',      icon: '👗' },
  { id: 'ajustes',       label: 'Ajustes',      icon: '✏️' },
  { id: 'produccion',    label: 'Producción',   icon: '🏭' },
];

const ORDEN: EstadoProyecto[] = ['inspiracion', 'en_desarrollo', 'muestra_lista', 'ajustes', 'produccion'];

export function FlujoDiseno({ estadoDiseno }: { estadoDiseno: EstadoProyecto }) {
  const idx = ORDEN.indexOf(estadoDiseno);

  return (
    <div className="flex items-center gap-0 w-full overflow-x-auto py-1">
      {PASOS.map((paso, i) => {
        const done   = i < idx;
        const active = i === idx;
        return (
          <div key={paso.id} className="flex items-center min-w-0">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              active ? 'bg-violet-600 text-white shadow-sm'
              : done  ? 'bg-emerald-100 text-emerald-700'
              :         'bg-stone-100 text-stone-400'
            }`}>
              <span>{paso.icon}</span>
              <span>{paso.label}</span>
            </div>
            {i < PASOS.length - 1 && (
              <div className={`w-6 h-px mx-1 shrink-0 ${done ? 'bg-emerald-300' : 'bg-stone-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
