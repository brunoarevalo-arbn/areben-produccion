import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Cortador predeterminado: el que se asigna solo a cada OP nueva (suelta o por
 * lote), para no tener que elegirlo a mano cada vez.
 *
 * Hay uno solo y es un flag de la tabla `cortadores`, no una constante: lo marca
 * el admin desde Configuración → Cortadores. Único lector del flag: nadie más
 * consulta `predeterminado` a mano.
 *
 * Devuelve null si no hay ninguno marcado o el marcado quedó inactivo — en ese
 * caso las OP nacen sin cortador, igual que antes.
 */
export async function cortadorPredeterminado(tx: Prisma.TransactionClient | typeof prisma = prisma) {
  return tx.cortador.findFirst({
    where: { predeterminado: true, activo: true },
    select: { id: true, nombre: true },
  });
}

/**
 * Deja `id` como único predeterminado dentro de la transacción: desmarca al
 * resto. Se llama al crear o editar un cortador con `predeterminado: true`.
 */
export async function dejarUnicoPredeterminado(tx: Prisma.TransactionClient, id: string) {
  await tx.cortador.updateMany({
    where: { predeterminado: true, id: { not: id } },
    data: { predeterminado: false },
  });
}
