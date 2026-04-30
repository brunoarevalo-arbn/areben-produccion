export const MARCAS_DISENO = ['Zattia', 'Stunned'] as const;

export type TipoDatos = 'calce' | 'medidas';

export const PASOS_CON_DATOS: Record<string, TipoDatos> = {
  'PRUEBA DE CALCE':    'calce',
  'MEDIDAS PRE-LAVADO': 'medidas',
  'MEDIDAS POST-LAVADO': 'medidas',
};

export const CAMPOS_MEDIDAS = [
  { key: 'talle',      label: 'Talle',          placeholder: 'Ej: M' },
  { key: 'busto',      label: 'Busto / Pecho',  placeholder: 'cm' },
  { key: 'cintura',    label: 'Cintura',         placeholder: 'cm' },
  { key: 'cadera',     label: 'Cadera',          placeholder: 'cm' },
  { key: 'hombro',     label: 'Hombro',          placeholder: 'cm' },
  { key: 'largoTotal', label: 'Largo total',     placeholder: 'cm' },
  { key: 'largoManga', label: 'Largo manga',     placeholder: 'cm' },
  { key: 'tiro',       label: 'Tiro',            placeholder: 'cm' },
] as const;
export type MarcaDiseno = typeof MARCAS_DISENO[number];

export const PASOS_DISENO = [
  'MATERIA PRIMA',
  'MOLDERÍA',
  'CORTAR MUESTRA',
  'CONFECCIÓN',
  'PRUEBA DE CALCE',
  'ARREGLO DE MOLDERÍA',
  'LAVADO',
  'MEDIDAS PRE-LAVADO',
  'MEDIDAS POST-LAVADO',
  'ARREGLO DE MOLDERÍA (FINAL)',
  'PLANIFICACIÓN DE PRODUCCIÓN',
  'PEDIDO DE TELA',
  'ARMADO DE FICHA DE CORTE',
  'CORTE',
  'ARMADO DE SKU',
  'ARMADO DE FICHA DE PRODUCCIÓN',
  'CONFECCIÓN (FINAL)',
] as const;

export type EstadoPaso = 'pendiente' | 'en_proceso' | 'completado';

export const ESTADO_PASO_LABEL: Record<EstadoPaso, string> = {
  pendiente:   'Pendiente',
  en_proceso:  'En proceso',
  completado:  'Completado',
};

export const ESTADO_PASO_COLOR: Record<EstadoPaso, string> = {
  pendiente:  'bg-stone-100 text-stone-500',
  en_proceso: 'bg-amber-100 text-amber-700',
  completado: 'bg-emerald-100 text-emerald-700',
};
