// Calcula el estado de un proyecto a partir de sus iteraciones y fases.
// El estado NO se guarda en DB — se deriva siempre del progreso real.

export type EstadoProyecto =
  | 'inspiracion'   // sin muestras
  | 'muestra'       // hay iteración no aprobada
  | 'aprobado'      // muestra aprobada, sin fases iniciadas
  | 'produccion'    // al menos una fase en_progreso
  | 'terminado'     // todas las fases iniciadas están completadas
  | 'archivado';

interface IteracionInput  { estado: string }
interface FaseInput       { estado: string; fase: { orden: number; nombre: string } }
interface ProyectoInput   { archivado: boolean; iteraciones: IteracionInput[]; fases: FaseInput[] }

export function calcularEstado(p: ProyectoInput): EstadoProyecto {
  if (p.archivado) return 'archivado';
  if (p.fases.length > 0) {
    const todasCompletas = p.fases.every((f) => f.estado === 'completada');
    if (todasCompletas) return 'terminado';
    return 'produccion';
  }
  const hayAprobada = p.iteraciones.some((it) => it.estado === 'aprobada');
  if (hayAprobada) return 'aprobado';
  if (p.iteraciones.length > 0) return 'muestra';
  return 'inspiracion';
}

// Si el proyecto está en "produccion", devuelve la fase que actualmente
// está en_progreso (la primera por orden) para mostrar en la card del Kanban.
export function faseActual(p: ProyectoInput): string | null {
  const enProgreso = p.fases
    .filter((f) => f.estado === 'en_progreso')
    .sort((a, b) => a.fase.orden - b.fase.orden);
  return enProgreso[0]?.fase.nombre ?? null;
}

export const ESTADO_LABEL: Record<EstadoProyecto, string> = {
  inspiracion: 'Inspiración',
  muestra:     'En muestra',
  aprobado:    'Aprobado',
  produccion:  'En producción',
  terminado:   'Terminado',
  archivado:   'Archivado',
};

export const ESTADO_COLOR: Record<EstadoProyecto, string> = {
  inspiracion: 'bg-violet-50  border-violet-200  text-violet-800',
  muestra:     'bg-amber-50   border-amber-200   text-amber-800',
  aprobado:    'bg-sky-50     border-sky-200     text-sky-800',
  produccion:  'bg-emerald-50 border-emerald-200 text-emerald-800',
  terminado:   'bg-stone-100  border-stone-300   text-stone-700',
  archivado:   'bg-stone-50   border-stone-200   text-stone-400',
};

// Columnas visibles del Kanban en orden.
export const KANBAN_COLUMNAS: EstadoProyecto[] = [
  'inspiracion', 'muestra', 'aprobado', 'produccion', 'terminado',
];
