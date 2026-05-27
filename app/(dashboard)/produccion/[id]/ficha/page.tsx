import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { FichaCorteForm } from '@/components/produccion/FichaCorteForm';

export const dynamic = 'force-dynamic';

export default async function FichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const orden = await prisma.ordenProduccion.findUnique({
    where: { id },
    select: { id: true, sku: true, estado: true, cantidad: true, fichaCorteCargada: true, descripcion: true, marca: true },
  });

  if (!orden) notFound();

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Produccion / Ficha de corte</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1 font-mono">{orden.sku}</h1>
        <p className="text-stone-500 text-sm mt-1">
          {orden.descripcion || orden.marca} · {orden.cantidad} unidades · {orden.estado}
        </p>
      </div>
      <FichaCorteForm ordenId={orden.id} sku={orden.sku} fichaCargada={orden.fichaCorteCargada} />
    </div>
  );
}
