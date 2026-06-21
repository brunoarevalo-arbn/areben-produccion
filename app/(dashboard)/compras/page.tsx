import Link from 'next/link';
import { ComprasUnificadasClient } from '@/components/compras/ComprasUnificadasClient';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function ComprasPage() {
  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        eyebrow="Compras"
        title="Compras y gastos"
        subtitle="Todo lo que le comprás a proveedores: insumos (genera stock) y gastos/desarrollo."
        actions={
          <Link href="/compras/nueva"
            className="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
            + Nueva compra
          </Link>
        }
      />
      <ComprasUnificadasClient />
    </div>
  );
}
