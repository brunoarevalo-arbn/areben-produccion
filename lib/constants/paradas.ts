// Motivos de parada de una corrida de muestra: el tiempo que NO es trabajo de
// un paso y que la costurera declara con "Paré un momento".
//
// 🔑 Se miden aparte y NO entran al estándar que baja al escandallo: una parada
// es tiempo del taller y el taller ya está adentro del costoMinuto absorbente
// (lib/costoMinuto.ts). Sumarla al paso la contaría dos veces.
export const MOTIVOS_PARADA = [
  'Buscar material',
  'Enhebrar / cambiar hilo',
  'Consulta',
  'Falla de máquina',
  'Otro',
] as const;

export type MotivoParada = (typeof MOTIVOS_PARADA)[number];
