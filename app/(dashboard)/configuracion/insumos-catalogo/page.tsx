import { prisma } from '@/lib/prisma';
import { InsumosCatalogoManager } from '@/components/configuracion/InsumosCatalogoManager';

export const dynamic = 'force-dynamic';

export default async function InsumosCatalogoPage() {
  const insumos = await prisma.insumo.findMany({
    orderBy: { nombre: 'asc' },
  });

  const serialized = JSON.parse(JSON.stringify(insumos));

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Configuracion</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Catalogo de Insumos</h1>
        <p className="text-stone-500 text-sm mt-1">Telas, etiquetas, badanas, hilos y otros materiales productivos.</p>
      </div>
      <InsumosCatalogoManager initial={serialized} />
    </div>
  );
}
