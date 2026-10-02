// La actividad de costura de producción. La comparten la tablet (que exige orden o
// "trabajo libre" para guardarla) y `lib/tiempos/registrar.ts` (que cobra el libre
// como gasto de taller). Vive acá y no en `registrar.ts` porque ése importa
// `prisma`, y un `'use client'` que lo importe lleva el driver al navegador.
export const ACTIVIDAD_PROCESO = 'Proceso Completado';
