import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { InsumoColoresManager } from '@/components/insumos/InsumoColoresManager';

export const dynamic = 'force-dynamic';

export default async function InsumoColoresPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const insumo = await prisma.insumo.findUnique({
    where: { id },
    select: { id: true, nombre: true, manejaColor: true },
  });

  if (!insumo) notFound();

  return (
    <div className="p-8 max-w-lg">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Inventario / Catálogo</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Colores de {insumo.nombre}</h1>
        <p className="text-stone-500 text-sm mt-1">
          {insumo.manejaColor
            ? 'Asocia colores del catalogo SKU a este insumo.'
            : 'Este insumo no tiene "Maneja color" activado. Activa la opcion desde el catalogo de insumos.'}
        </p>
      </div>
      {insumo.manejaColor && (
        <InsumoColoresManager insumoId={insumo.id} insumoNombre={insumo.nombre} />
      )}
    </div>
  );
}
