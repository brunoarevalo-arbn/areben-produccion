// Máquinas de costura. Fuente única (antes duplicada en FormTiempos y ReportesClient).
//
// 🔑 `MAQUINA_NINGUNA` ⛔ NO es una máquina: es la AFIRMACIÓN "este trabajo no usó
// ninguna" (cortar hilos, dar vuelta, controlar, ordenar la mesa). Es distinta de
// `maquina = null`, que significa "no dijo" — un agujero en el dato. Por eso tiene
// nombre propio en vez de dejarse vacía, igual que `PARTE_COMPARTIDA`.
// ⚠️ Los `null` históricos ⛔ NO se rellenan con esto: sería inventar lo que se perdió.
//
// Va ÚLTIMA a propósito: es la salida fácil y no tiene que quedar a mano.
export const MAQUINA_NINGUNA = 'Sin máquina';

export const MAQUINAS = ['Recta', 'Collareta', 'Remalladora', 'Cadeneta', 'Cortacollareta', MAQUINA_NINGUNA] as const;
