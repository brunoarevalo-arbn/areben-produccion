import Link from 'next/link';
import type { EstadoPaso, MarcaDiseno } from '@/lib/constants/diseno';
import { ESTADO_PASO_COLOR } from '@/lib/constants/diseno';

interface Paso {
  numeroPaso: number;
  nombrePaso: string;
  estado:     string;
}

interface Props {
  proyecto: {
    id:          string;
    nombre:      string;
    marca:       string;
    estado:      string;
    inspiracion?: string | null;
    pasos:       Paso[];
    createdAt:   Date | string;
  };
  seleccionable?: boolean;
  seleccionado?:  boolean;
  onToggle?:      (id: string) => void;
}

const MARCA_COLOR: Record<MarcaDiseno, string> = {
  Zattia:  'bg-violet-100 text-violet-700',
  Stunned: 'bg-amber-100 text-amber-700',
};

const CICLO_BADGE: Record<string, string> = {
  activo:    '',
  standby:   'bg-amber-100 text-amber-600',
  archivado: 'bg-stone-100 text-stone-400',
};

export function ProyectoCard({ proyecto, seleccionable, seleccionado, onToggle }: Props) {
  const completados = proyecto.pasos.filter((p) => p.estado === 'completado').length;
  const enProceso   = proyecto.pasos.filter((p) => p.estado === 'en_proceso').length;
  const total       = proyecto.pasos.length;
  const pct         = total > 0 ? Math.round((completados / total) * 100) : 0;

  const estadoGeneral: EstadoPaso =
    completados === total && total > 0 ? 'completado'
    : enProceso > 0 || completados > 0 ? 'en_proceso'
    : 'pendiente';

  const pasoActivo =
    proyecto.pasos.find((p) => p.estado === 'en_proceso') ??
    proyecto.pasos.find((p) => p.estado === 'pendiente');

  const cicloBadge = CICLO_BADGE[proyecto.estado ?? 'activo'];

  const inner = (
    <div className={`bg-white rounded-2xl border p-5 transition-shadow h-full relative ${
      proyecto.estado === 'archivado' ? 'border-stone-200 opacity-70' : 'border-stone-200'
    } ${seleccionable ? (seleccionado ? 'ring-2 ring-violet-500 border-violet-300' : 'hover:border-stone-300') : 'hover:shadow-md'}`}>

      {/* Checkbox overlay */}
      {seleccionable && (
        <div className={`absolute top-3 left-3 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
          seleccionado ? 'bg-violet-600 border-violet-600' : 'bg-white border-stone-300'
        }`}>
          {seleccionado && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      )}

      <div className={`flex items-start justify-between gap-2 mb-2 ${seleccionable ? 'pl-7' : ''}`}>
        <h3 className="font-bold text-stone-900 text-sm leading-tight group-hover:text-violet-700 transition-colors">
          {proyecto.nombre}
        </h3>
        <div className="flex gap-1 shrink-0">
          {cicloBadge && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cicloBadge}`}>
              {proyecto.estado}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
            MARCA_COLOR[proyecto.marca as MarcaDiseno] ?? 'bg-stone-100 text-stone-500'
          }`}>
            {proyecto.marca}
          </span>
        </div>
      </div>

      {proyecto.inspiracion && (
        <p className={`text-xs text-stone-400 mb-3 line-clamp-2 leading-relaxed ${seleccionable ? 'pl-7' : ''}`}>
          {proyecto.inspiracion}
        </p>
      )}

      {pasoActivo && completados < total && (
        <div className={`text-xs font-medium px-2.5 py-1.5 rounded-lg mb-3 flex items-center gap-1.5 ${
          pasoActivo.estado === 'en_proceso' ? 'bg-amber-50 text-amber-700' : 'bg-stone-50 text-stone-500'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            pasoActivo.estado === 'en_proceso' ? 'bg-amber-400' : 'bg-stone-300'
          }`} />
          <span className="truncate">
            {pasoActivo.estado === 'en_proceso' ? '' : 'Próximo: '}
            {pasoActivo.nombrePaso}
          </span>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className={`px-2 py-0.5 rounded-full font-medium ${ESTADO_PASO_COLOR[estadoGeneral]}`}>
            {completados === total && total > 0 ? 'Completado' : enProceso > 0 ? 'En proceso' : 'Pendiente'}
          </span>
          <span className="text-stone-400">{completados}/{total} pasos</span>
        </div>
        <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );

  if (seleccionable) {
    return (
      <div className="group block cursor-pointer" onClick={() => onToggle?.(proyecto.id)}>
        {inner}
      </div>
    );
  }

  return (
    <Link href={`/diseno/${proyecto.id}`} className="group block">
      {inner}
    </Link>
  );
}
