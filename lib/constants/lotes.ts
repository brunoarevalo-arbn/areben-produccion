// Lotes planificados: lo que comparten el servidor y las pantallas (ver
// `lib/produccion/lotesPlanificados.ts`). Sin Prisma adentro, para que lo pueda importar
// un componente de cliente.
import { TALLES_DEFAULT } from '@/lib/validators/produccion';

/** Lo que dice el Lote 1 en "después de": es el corte original, no se separó de nada. */
export const DESPUES_DE_LOTE_1 = 'Corte';

/** En qué punto se separa. La tablet no tiene lista de procesos: son las máquinas, más el corte. */
export const PUNTOS_DE_SEPARACION = ['Todo cortado', 'Recta', 'Remallado', 'Collareta', 'Cadeneta', 'Cortacollareta'] as const;

/**
 * La máquina de cada proceso. Una separación programada "para cuando termine el Remallado"
 * se le pregunta a la costurera cuando el trabajo DEJA esa máquina: elige otra en la tablet.
 * "Todo cortado" no tiene máquina: no se programa, se separa en el momento.
 */
export const MAQUINA_DEL_PROCESO: Record<string, string> = {
  Recta: 'Recta', Remallado: 'Remalladora', Collareta: 'Collareta', Cadeneta: 'Cadeneta', Cortacollareta: 'Cortacollareta',
};

const ordenTalle = (t: string) => {
  const i = (TALLES_DEFAULT as readonly string[]).indexOf(t);
  return i === -1 ? 99 : i;
};
export const ordenarTalles = <T extends { talle: string }>(ts: T[]) =>
  [...ts].sort((a, b) => ordenTalle(a.talle) - ordenTalle(b.talle) || a.talle.localeCompare(b.talle));

/** "S 10 · M 10": como se escribe en la etiqueta y en el historial. */
export const textoTalles = (ts: { talle: string; cantidad: number }[]) =>
  ordenarTalles(ts.filter((t) => t.cantidad > 0)).map((t) => `${t.talle} ${t.cantidad}`).join(' · ');
