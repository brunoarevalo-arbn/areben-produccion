import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { GastoDetalle } from '@/components/compras/GastoDetalle';

export const dynamic = 'force-dynamic';

// Un id de /compras puede ser un Gasto (compra sin stock) o una Compra de insumos.
// Si es Gasto → detalle simple. Si no → es una Compra, redirige a su detalle en Inventario.
export default async function CompraDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gasto = await prisma.gasto.findUnique({
    where: { id },
    include: { proveedor: { select: { nombre: true } } },
  });
  if (!gasto) redirect(`/inventario/compras/${id}`);

  const g = {
    id: gasto.id, categoria: gasto.categoria, tipo: gasto.tipo, marca: gasto.marca, sku: gasto.sku,
    monto: gasto.monto, concepto: gasto.concepto, fecha: gasto.fecha, creadoPor: gasto.creadoPor,
    proveedorNombre: gasto.proveedor?.nombre ?? null, numeroFactura: gasto.numeroFactura,
    estadoPago: gasto.estadoPago as string | null,
    montoPagado: gasto.montoPagado != null ? Number(gasto.montoPagado) : null,
    fechaPago: gasto.fechaPago, formaPago: gasto.formaPago,
  };

  return <div className="p-8"><GastoDetalle gasto={g} /></div>;
}
