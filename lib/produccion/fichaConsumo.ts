// Consumo de tela de la ficha de corte de un SKU: total y por prenda (metros y kg),
// más la cantidad cortada. Sirve para mostrar la "tizada" (X m × Y u) y el consumo
// unitario en el escandallo. Usa la OP más reciente con ficha cargada.
import { prisma } from '@/lib/prisma';
import { consumoNetoPorRollo } from '@/lib/produccion/consumo';

export interface FichaConsumo {
  cantidad: number;
  metrosTotal: number;
  kgTotal: number;
  metrosUnit: number;
  kgUnit: number;
}

export async function fichaConsumoSku(sku: string | null | undefined): Promise<FichaConsumo | null> {
  if (!sku?.trim()) return null;
  const orden = await prisma.ordenProduccion.findFirst({
    where: { sku: { equals: sku.trim(), mode: 'insensitive' }, fichaCorteCargada: true },
    orderBy: { createdAt: 'desc' },
    include: {
      movimientosInsumo: {
        where: { rolloId: { not: null } },
        include: { rollo: { select: { insumo: { select: { unidadDefault: true, rinde: true } } } } },
      },
    },
  });
  if (!orden) return null;
  const { kg, metros } = consumoNetoPorRollo(
    orden.movimientosInsumo.map((m) => ({ rolloId: m.rolloId, cantidad: Number(m.cantidad), unidadDefault: m.rollo?.insumo.unidadDefault ?? null, rinde: m.rollo?.insumo.rinde ? Number(m.rollo.insumo.rinde) : null })),
  );
  const cant = orden.cantidad || 0;
  return {
    cantidad: cant,
    metrosTotal: metros,
    kgTotal: kg,
    metrosUnit: cant > 0 ? metros / cant : 0,
    kgUnit: cant > 0 ? kg / cant : 0,
  };
}
