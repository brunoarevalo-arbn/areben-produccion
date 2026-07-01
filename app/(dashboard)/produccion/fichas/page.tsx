import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { FichasCorteClient } from '@/components/produccion/FichasCorteClient';

export const dynamic = 'force-dynamic';

export default async function FichasPage() {
  const ordenes = await prisma.ordenProduccion.findMany({
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true, sku: true, descripcion: true, marca: true, cantidad: true,
      estado: true, fichaCorteCargada: true,
    },
  });

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        eyebrow="Producción"
        title="Fichas de corte"
        subtitle="Buscá cualquier SKU y ver o cargar su ficha. Filtrá por con/sin ficha."
      />
      <FichasCorteClient ordenes={ordenes} />
    </div>
  );
}
