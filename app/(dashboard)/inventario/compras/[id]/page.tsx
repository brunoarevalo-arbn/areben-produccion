import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { CompraDetalle } from '@/components/inventario/CompraDetalle';
import { PageHeader } from '@/components/ui/PageHeader';
import Link from 'next/link';
import { volverASeguro } from '@/lib/volverA';

export const dynamic = 'force-dynamic';

export default async function CompraDetallaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ volverA?: string }> }) {
  const { id } = await params;
  const volver = volverASeguro((await searchParams).volverA, '/inventario/compras');

  const compra = await prisma.compra.findUnique({
    where: { id },
    include: {
      proveedor: true,
      lineas: {
        include: { insumo: { select: { nombre: true, categoria: true, tipoTrazabilidad: true } } },
      },
      rollos: {
        include: { insumo: { select: { nombre: true } }, color: { select: { nombre: true } } },
      },
      lotes: {
        include: { insumo: { select: { nombre: true } }, color: { select: { nombre: true } } },
      },
    },
  });

  if (!compra) notFound();

  const serialized = JSON.parse(JSON.stringify(compra));

  return (
    <div className="p-8 max-w-5xl">
      <Link href={volver} className="text-sm text-stone-500 hover:text-stone-800 transition">← Volver</Link>
      <PageHeader
        eyebrow="Inventario"
        title={`Compra ${compra.numeroFactura || compra.id.slice(0, 8)}`}
      />
      <CompraDetalle compra={serialized} />
    </div>
  );
}
