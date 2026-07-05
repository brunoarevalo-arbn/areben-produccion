import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { InsumoColoresManager } from '@/components/inventario/InsumoColoresManager';
import { PageHeader } from '@/components/ui/PageHeader';

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
      <PageHeader
        eyebrow="Inventario / Catálogo"
        title={`Colores de ${insumo.nombre}`}
        subtitle={
          insumo.manejaColor
            ? 'Asocia colores del catalogo SKU a este insumo.'
            : 'Este insumo no tiene "Maneja color" activado. Activa la opcion desde el catalogo de insumos.'
        }
      />
      {insumo.manejaColor && (
        <InsumoColoresManager insumoId={insumo.id} insumoNombre={insumo.nombre} />
      )}
    </div>
  );
}
