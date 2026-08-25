import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { RolloDetalle } from '@/components/inventario/RolloDetalle';
import { PageHeader } from '@/components/ui/PageHeader';
import Link from 'next/link';
import { volverASeguro } from '@/lib/volverA';

export const dynamic = 'force-dynamic';

export default async function RolloDetallePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ volverA?: string }> }) {
  const { id } = await params;
  const volver = volverASeguro((await searchParams).volverA, '/inventario/rollos');

  const rollo = await prisma.rollo.findUnique({
    where: { id },
    include: {
      insumo: { select: { nombre: true, categoria: true, unidadDefault: true, anchoCm: true, tubular: true } },
      color: { select: { nombre: true } },
      compra: { select: { id: true, fecha: true, numeroFactura: true, proveedor: { select: { nombre: true } } } },
      movimientos: { orderBy: { fecha: 'desc' } },
    },
  });

  if (!rollo) notFound();

  const serialized = JSON.parse(JSON.stringify(rollo));

  return (
    <div className="p-8 max-w-4xl">
      <Link href={volver} className="text-sm text-stone-500 hover:text-stone-800 transition">← Volver</Link>
      <PageHeader eyebrow="Inventario / Rollos" title={`Rollo ${rollo.codigo}`} />
      <RolloDetalle rollo={serialized} />
    </div>
  );
}
