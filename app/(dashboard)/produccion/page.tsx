import Link from 'next/link';
import { Suspense } from 'react';
import { ColaAdmin } from '@/components/produccion/ColaAdmin';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';

export const dynamic = 'force-dynamic';

const ACCESOS = [
  { label: 'Fichas de corte',  href: '/produccion/fichas',       icon: '📋', color: 'bg-amber-50 border-amber-200 hover:border-amber-400' },
  { label: 'Reportes Diarios', href: '/produccion/reportes',     icon: '📊', color: 'bg-stone-50 border-stone-200 hover:border-stone-400' },
  { label: 'Costos por SKU',   href: '/produccion/reportes/sku', icon: '📦', color: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400' },
  { label: 'Catálogo de SKU',  href: '/produccion/catalogo-sku', icon: '🏷', color: 'bg-violet-50 border-violet-200 hover:border-violet-400' },
];

export default function ProduccionPage() {
  return (
    <div className="p-6 md:p-8 max-w-7xl">
      <PageHeader eyebrow="Producción" title="Control de Producción" subtitle="Cola de trabajo, tiempos y reportes del taller." />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 max-w-2xl">
        {ACCESOS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`flex items-center gap-2 rounded-xl border p-3 transition ${a.color}`}
          >
            <span className="text-xl shrink-0">{a.icon}</span>
            <span className="text-sm font-semibold text-stone-700 leading-tight">{a.label}</span>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-bold text-stone-900 mb-1">Cola de producción</h2>
        <p className="text-stone-500 text-sm mb-5">
          Agregá órdenes por SKU. Las costureras las ven en tiempo real y marcan cuando terminan.
        </p>
        {/* Filtro/búsqueda/lotes viven en la query (useSearchParams) → Suspense obligatorio. */}
        <Suspense fallback={<LoadingState />}>
          <ColaAdmin />
        </Suspense>
      </div>
    </div>
  );
}
