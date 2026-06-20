import Link from 'next/link';
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
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Inventario</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Catálogo de insumos</h1>
        <p className="text-stone-500 text-sm mt-1">Telas, etiquetas, badanas, hilos y otros materiales productivos.</p>
        <Link href="/inventario/catalogo/avios" className="inline-block mt-3 text-xs text-violet-700 hover:text-violet-900 transition">
          → Catálogo de avíos/etiquetas (alta rápida con precio y stock)
        </Link>
      </div>
      <InsumosCatalogoManager initial={serialized} />
    </div>
  );
}
