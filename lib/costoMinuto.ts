import { prisma } from '@/lib/prisma';

export async function calcularCostoMinuto(): Promise<number> {
  const [gastos, costureras] = await Promise.all([
    prisma.gastoFijoTaller.findMany({ where: { activo: true } }),
    prisma.costoCosturera.findMany(),
  ]);
  const totalGastos   = gastos.reduce((s, g) => s + g.monto, 0);
  const totalCosturas = costureras.reduce((s, c) => s + c.sueldoBruto + c.cargasSociales, 0);
  const totalHoras    = costureras.reduce((s, c) => s + c.horasMes, 0);
  if (totalHoras === 0) return 0;
  return (totalGastos + totalCosturas) / totalHoras / 60;
}
