import Link from 'next/link';
import { Suspense } from 'react';
import { ComprasUnificadasClient } from '@/components/compras/ComprasUnificadasClient';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';

export const dynamic = 'force-dynamic';

export default function ComprasPage() {
  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        eyebrow="Compras"
        title="Compras y gastos"
        subtitle="Todo lo que le comprás a proveedores: compras de tela (generan stock) y gastos/compras sin stock."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/inventario/compras/nueva"
              className="border border-stone-200 hover:border-stone-400 text-stone-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition">
              + Compra de tela (stock)
            </Link>
            <Link href="/compras/nueva"
              className="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
              + Gasto / compra
            </Link>
          </div>
        }
      />
      {/* El filtro va en la query (useSearchParams) → Suspense obligatorio. */}
      <Suspense fallback={<LoadingState />}>
        <ComprasUnificadasClient />
      </Suspense>
    </div>
  );
}
