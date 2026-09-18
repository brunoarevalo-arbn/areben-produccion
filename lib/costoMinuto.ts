import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * El $/minuto ABSORBENTE del taller: gastos fijos + sueldos con cargas, sobre las horas
 * del mes. Por eso una parada ya está adentro y no se le suma al paso que la sufrió.
 *
 * Acepta un cliente para poder calcularse DENTRO de una transacción (el congelado de un
 * lote lo necesita en la misma tx que ingresa el stock). Sin el parámetro usa el cliente
 * global, que es como lo llaman el registro de tiempos y la pantalla de precios.
 */
export async function calcularCostoMinuto(db: Db = prisma): Promise<number> {
  const [gastos, costureras] = await Promise.all([
    db.gastoFijoTaller.findMany({ where: { activo: true } }),
    db.costoCosturera.findMany(),
  ]);
  const totalGastos   = gastos.reduce((s, g) => s + g.monto, 0);
  const totalCosturas = costureras.reduce((s, c) => s + c.sueldoBruto + c.cargasSociales, 0);
  const totalHoras    = costureras.reduce((s, c) => s + c.horasMes, 0);
  if (totalHoras === 0) return 0;
  return (totalGastos + totalCosturas) / totalHoras / 60;
}
