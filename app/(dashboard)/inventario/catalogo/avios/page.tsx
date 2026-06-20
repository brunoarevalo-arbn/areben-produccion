import Link from 'next/link';
import { AviosCatalogoManager } from '@/components/inventario/AviosCatalogoManager';

export const dynamic = 'force-dynamic';

export default function AviosCatalogoPage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Inventario / Catálogo</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Avíos y etiquetas</h1>
        <p className="text-stone-500 text-sm mt-1">
          Cargá tus avíos con nombre y precio. El stock es opcional: lo activás cuando quieras seguir cantidades.
        </p>
        <Link href="/inventario/catalogo" className="inline-block mt-3 text-xs text-stone-500 hover:text-stone-800 transition">
          ← Catálogo de insumos (telas, etc.)
        </Link>
      </div>
      <AviosCatalogoManager />
    </div>
  );
}
