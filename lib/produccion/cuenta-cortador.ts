import { prisma } from '@/lib/prisma';

/**
 * Cuenta corriente del cortador.
 *
 *   saldo = cortes cobrables sin pagar + muestras validadas sin pagar − pagos a cuenta
 *
 * Un `PagoCorte` SIN ordenes ni muestras es un **pago a cuenta**: monto libre que no
 * imputa ningún ítem (el adelanto, o el pago suelto que no cierra con ningún corte).
 * Como nunca marca ítems, nunca se pisa con un pago imputado: no hay doble conteo y
 * los pagos históricos no necesitan backfill.
 *
 * El saldo puede quedar NEGATIVO: eso es saldo a favor del taller.
 */
const A_CUENTA = { ordenes: { none: {} }, muestras: { none: {} } } as const;

/** Total pagado a cuenta (sin imputar) a un cortador. */
export async function pagosACuentaDe(cortadorId: string): Promise<number> {
  const r = await prisma.pagoCorte.aggregate({
    where: { cortadorId, ...A_CUENTA },
    _sum: { montoTotal: true },
  });
  return Number(r._sum.montoTotal ?? 0);
}

/** Total pagado a cuenta por cortador, para el hub. */
export async function pagosACuentaPorCortador(): Promise<Map<string, number>> {
  const filas = await prisma.pagoCorte.groupBy({
    by: ['cortadorId'],
    where: { cortadorId: { not: null }, ...A_CUENTA },
    _sum: { montoTotal: true },
  });
  return new Map(filas.map((f) => [f.cortadorId!, Number(f._sum.montoTotal ?? 0)]));
}

/** Los pagos a cuenta de un cortador, para listarlos en el historial. */
export function esPagoACuenta(pago: { _count: { ordenes: number; muestras: number } }) {
  return pago._count.ordenes === 0 && pago._count.muestras === 0;
}
