// Marcas propias del taller. Única fuente: antes estaba repetida a mano en
// el alta de proyectos y en la home del dashboard.
export const MARCAS = ['Zattia', 'Stunned'] as const;

export type Marca = typeof MARCAS[number];
