// Las constantes de las prendas que se cosen por PARTES.
//
// 🔴 Viven acá y ⛔ no en `lib/produccion/conjuntos.ts` por una razón que no se ve
// leyendo el código: `conjuntos.ts` importa `prisma`, y la TABLET es un componente
// de cliente. Importar la constante desde ahí se lleva el driver de Postgres al
// bundle del navegador y el endpoint revienta con 500.
// ⚠️ `tsc` y `lint` pasan igual: lo caza sólo ejercerlo. Por eso esto está suelto,
// junto a `maquinas.ts` y `paradas.ts`, que la tablet ya importaba.

/**
 * La parte que ⛔ NO es una parte: trabajo que sirve a TODAS las piezas a la vez.
 *
 * 🔑 El caso real es la CORTACOLLARETA. Arma el tubo de una sola vez y de ahí sale
 * la tira que va al corpiño **y** a la bombacha ⇒ esos minutos no son de ninguna
 * de las dos, son de las dos. Anotarlos en una sola la infla y vacía la otra.
 *
 * ⚠️ Es DISTINTO de `parte = null`, que significa "no dijo qué pieza" — un agujero
 * en el dato. Esto es una afirmación: "va a todas". Por eso se guarda con nombre
 * propio en vez de dejarlo vacío.
 */
export const PARTE_COMPARTIDA = 'Compartido';

/** La máquina cuyo trabajo sirve a todas las piezas del conjunto. */
export const MAQUINA_COMPARTIDA = 'Cortacollareta';
