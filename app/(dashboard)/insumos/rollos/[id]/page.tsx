import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { RolloDetalle } from '@/components/insumos/RolloDetalle';

export const dynamic = 'force-dynamic';

export default async function RolloDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rollo = await prisma.rollo.findUnique({
    where: { id },
    include: {
      insumo: { select: { nombre: true, categoria: true, unidadDefault: true } },
      compra: { select: { id: true, fecha: true, numeroFactura: true, proveedor: { select: { nombre: true } } } },
      movimientos: { orderBy: { fecha: 'desc' } },
    },
  });

  if (!rollo) notFound();

  const serialized = JSON.parse(JSON.stringify(rollo));

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Insumos / Rollos</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Rollo {rollo.codigo}</h1>
      </div>
      <RolloDetalle rollo={serialized} />
    </div>
  );
}
