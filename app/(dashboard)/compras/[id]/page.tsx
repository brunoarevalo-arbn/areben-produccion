import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { GastoDetalle } from '@/components/compras/GastoDetalle';
import { volverASeguro } from '@/lib/volverA';

export const dynamic = 'force-dynamic';

// Un id de /compras puede ser un Gasto (compra sin stock) o una Compra de insumos.
// Si es Gasto → detalle simple. Si no → es una Compra, redirige a su detalle en Inventario.
export default async function CompraDetallePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ volverA?: string }> }) {
  const { id } = await params;
  const volver = volverASeguro((await searchParams).volverA, '/compras');
  const gasto = await prisma.gasto.findUnique({
    where: { id },
    include: { proveedor: { select: { nombre: true } } },
  });
  // No era un Gasto: es una Compra de insumos. El `volverA` viaja con el redirect para que
  // el detalle de allá también sepa volver a la lista con su filtro.
  if (!gasto) redirect(`/inventario/compras/${id}?volverA=${encodeURIComponent(volver)}`);

  const g = {
    id: gasto.id, categoria: gasto.categoria, tipo: gasto.tipo, marca: gasto.marca, sku: gasto.sku,
    monto: gasto.monto, concepto: gasto.concepto, fecha: gasto.fecha, creadoPor: gasto.creadoPor,
    proveedorNombre: gasto.proveedor?.nombre ?? null, numeroFactura: gasto.numeroFactura,
    estadoPago: gasto.estadoPago as string | null,
    montoPagado: gasto.montoPagado != null ? Number(gasto.montoPagado) : null,
    fechaPago: gasto.fechaPago, formaPago: gasto.formaPago,
  };

  return <div className="p-8"><GastoDetalle gasto={g} volver={volver} /></div>;
}
