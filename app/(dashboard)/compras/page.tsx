import Link from 'next/link';
import { ComprasUnificadasClient } from '@/components/compras/ComprasUnificadasClient';

export const dynamic = 'force-dynamic';

export default function ComprasPage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Compras</span>
          <h1 className="text-2xl font-bold text-stone-900 mt-1">Compras y gastos</h1>
          <p className="text-stone-500 text-sm mt-1">Todo lo que le comprás a proveedores: insumos (genera stock) y gastos/desarrollo.</p>
        </div>
        <Link href="/compras/nueva"
          className="shrink-0 bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
          + Nueva compra
        </Link>
      </div>
      <ComprasUnificadasClient />
    </div>
  );
}
