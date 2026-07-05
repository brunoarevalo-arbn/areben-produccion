import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { RolloDetalle } from '@/components/inventario/RolloDetalle';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default async function RolloDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rollo = await prisma.rollo.findUnique({
    where: { id },
    include: {
      insumo: { select: { nombre: true, categoria: true, unidadDefault: true } },
      color: { select: { nombre: true } },
      compra: { select: { id: true, fecha: true, numeroFactura: true, proveedor: { select: { nombre: true } } } },
      movimientos: { orderBy: { fecha: 'desc' } },
    },
  });

  if (!rollo) notFound();

  const serialized = JSON.parse(JSON.stringify(rollo));

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader eyebrow="Inventario / Rollos" title={`Rollo ${rollo.codigo}`} />
      <RolloDetalle rollo={serialized} />
    </div>
  );
}
