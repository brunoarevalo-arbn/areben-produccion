import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { CompraDetalle } from '@/components/insumos/CompraDetalle';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default async function CompraDetallaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const compra = await prisma.compra.findUnique({
    where: { id },
    include: {
      proveedor: true,
      lineas: {
        include: { insumo: { select: { nombre: true, categoria: true, tipoTrazabilidad: true } } },
      },
      rollos: {
        include: { insumo: { select: { nombre: true } } },
      },
      lotes: {
        include: { insumo: { select: { nombre: true } } },
      },
    },
  });

  if (!compra) notFound();

  const serialized = JSON.parse(JSON.stringify(compra));

  return (
    <div className="p-8 max-w-5xl">
      <PageHeader
        eyebrow="Inventario"
        title={`Compra ${compra.numeroFactura || compra.id.slice(0, 8)}`}
      />
      <CompraDetalle compra={serialized} />
    </div>
  );
}
