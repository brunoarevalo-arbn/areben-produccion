export const INCONVENIENTES = [
  'Corte mal cortado',
  'Quedan ajustes',
  'Material faltante / equivocado',
  'Otro',
] as const;

export type Inconveniente = (typeof INCONVENIENTES)[number];
