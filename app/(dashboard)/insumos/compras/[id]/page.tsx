import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { CompraDetalle } from '@/components/insumos/CompraDetalle';

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
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Insumos</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Compra {compra.numeroFactura || compra.id.slice(0, 8)}</h1>
      </div>
      <CompraDetalle compra={serialized} />
    </div>
  );
}
