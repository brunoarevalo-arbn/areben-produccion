import { prisma } from '@/lib/prisma';

export async function nextCodigoRollo(): Promise<string> {
  const ultimo = await prisma.rollo.findFirst({
    orderBy: { codigo: 'desc' },
    select: { codigo: true },
  });
  const num = ultimo ? parseInt(ultimo.codigo.replace('R-', ''), 10) + 1 : 1;
  return `R-${String(num).padStart(4, '0')}`;
}

export async function nextCodigoLote(): Promise<string> {
  const ultimo = await prisma.lote.findFirst({
    orderBy: { codigo: 'desc' },
    select: { codigo: true },
  });
  const num = ultimo ? parseInt(ultimo.codigo.replace('L-', ''), 10) + 1 : 1;
  return `L-${String(num).padStart(4, '0')}`;
}
