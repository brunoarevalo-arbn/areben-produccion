import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import type { EstadoRollo } from '@prisma/client';

/**
 * Error de negocio del retiro de tela para muestra. A diferencia de CorteError,
 * lleva el status porque acá conviven 400 (validación), 403 (no es tuyo), 404 y
 * 409 (posible duplicado / el rollo ya no da para deshacer). `payload` se
 * mergea en el body de la respuesta: lo usa el aviso de duplicado para mandar
 * `code` y los datos del retiro previo.
 */
export class MuestraError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
    readonly payload?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/**
 * Traductor único de MuestraError → respuesta. Cualquier otro error se relanza
 * para que lo tome el manejo de errores de Next (500) y no quede tapado.
 */
export function responderMuestraError(e: unknown) {
  if (e instanceof MuestraError) {
    return NextResponse.json({ error: e.message, ...e.payload }, { status: e.status });
  }
  throw e;
}

/** Tolerancia de peso en kg: por debajo de esto el rollo se considera agotado. */
export const EPS = new Prisma.Decimal('0.01');

/** "No cambió nada" al editar: evita escribir el rollo por un redondeo. */
export const EPS_CERO = new Prisma.Decimal('0.000001');

/** Metros → kg. El rinde del insumo es metros por kg. */
export function kgDesdeMetros(metros: number, rinde: number): Prisma.Decimal {
  return new Prisma.Decimal(metros / rinde);
}

/**
 * Estado del rollo según su peso. DESCARTADO nunca se resucita: es una decisión
 * humana, no una consecuencia del peso — devolverle kg a un rollo descartado
 * (al eliminar un retiro) no lo vuelve a poner en circulación.
 */
export function estadoRollo(
  peso: Prisma.Decimal,
  pesoInicial: Prisma.Decimal,
  actual: EstadoRollo,
): EstadoRollo {
  if (actual === 'DESCARTADO') return 'DESCARTADO';
  if (peso.lte(EPS)) return 'AGOTADO';
  if (peso.lt(pesoInicial)) return 'EN_USO_PARCIAL';
  return 'DISPONIBLE';
}

/**
 * Concepto del gasto de desarrollo. No cambiar la forma: los gastos ya
 * registrados se identifican por este prefijo.
 */
export function conceptoMuestra(a: {
  insumo: string;
  metros: number;
  descripcion?: string | null;
  proyecto?: string | null;
}): string {
  return `Muestra — ${a.insumo} · ${a.metros} m`
    + (a.descripcion ? ` (${a.descripcion})` : '')
    + (a.proyecto ? ` · ${a.proyecto}` : '');
}

/**
 * Editar o eliminar un retiro lo puede hacer quien lo cargó, o un admin. Que la
 * diseñadora pueda deshacer su propio error sin pedirle permiso a nadie es el
 * punto: un retiro mal cargado mueve stock y escribe un gasto.
 */
export function puedeTocar(
  mov: { usuarioId: string },
  session: { id: string; rol: string },
): boolean {
  return session.rol === 'admin' || mov.usuarioId === session.id;
}

/**
 * Ajusta el peso del rollo de forma atómica y valida el resultado REAL.
 *
 * El orden importa: se escribe con `decrement` (lo resuelve Postgres) y recién
 * después se valida sobre el valor devuelto. Así no hay ventana entre validar y
 * escribir, y si no cierra, el throw revierte toda la transacción. Leer el peso
 * antes y escribir un valor absoluto —como hacía el POST original— deja que dos
 * retiros concurrentes del mismo rollo se pisen el descuento.
 *
 * `delta` en kg: positivo descuenta, negativo devuelve.
 */
export async function ajustarPesoRollo(
  tx: Prisma.TransactionClient,
  rolloId: string,
  delta: Prisma.Decimal,
  errores: { falta: (disponibleKg: Prisma.Decimal) => string; sobra: (pesoKg: Prisma.Decimal, inicialKg: Prisma.Decimal) => string },
) {
  const upd = await tx.rollo.update({
    where: { id: rolloId },
    data: { pesoActual: { decrement: delta } },
  });

  if (upd.pesoActual.lessThan(0)) {
    // El disponible real es lo que había antes de este ajuste.
    throw new MuestraError(errores.falta(upd.pesoActual.add(delta)));
  }
  if (upd.pesoActual.greaterThan(upd.pesoInicial.add(EPS))) {
    throw new MuestraError(errores.sobra(upd.pesoActual, upd.pesoInicial), 409);
  }

  const estado = estadoRollo(upd.pesoActual, upd.pesoInicial, upd.estado);
  if (estado !== upd.estado) {
    await tx.rollo.update({ where: { id: rolloId }, data: { estado } });
  }

  return upd;
}
