import Link from 'next/link';
import { AviosCatalogoManager } from '@/components/inventario/AviosCatalogoManager';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function AviosCatalogoPage() {
  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        eyebrow="Inventario / Catálogo"
        title="Avíos y etiquetas"
        subtitle="Cargá tus avíos con nombre y precio. El stock es opcional: lo activás cuando quieras seguir cantidades."
        actions={
          <Link href="/inventario/catalogo" className="inline-block text-xs text-stone-500 hover:text-stone-800 transition">
            ← Catálogo de insumos (telas, etc.)
          </Link>
        }
      />
      <AviosCatalogoManager />
    </div>
  );
}
