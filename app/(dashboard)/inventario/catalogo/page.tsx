import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { InsumosCatalogoManager } from '@/components/configuracion/InsumosCatalogoManager';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default async function InsumosCatalogoPage() {
  const insumos = await prisma.insumo.findMany({
    orderBy: { nombre: 'asc' },
  });

  const serialized = JSON.parse(JSON.stringify(insumos));

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        eyebrow="Inventario"
        title="Catálogo de insumos"
        subtitle="Telas, vinilos, packaging y otros materiales productivos. Los avíos (etiquetas, badanas, hilos) se cargan en su propio catálogo."
        actions={
          <Link href="/inventario/catalogo/avios" className="inline-block text-xs text-violet-700 hover:text-violet-900 transition">
            → Ir al Catálogo de avíos (alta rápida con precio y stock)
          </Link>
        }
      />
      <InsumosCatalogoManager initial={serialized} />
    </div>
  );
}
