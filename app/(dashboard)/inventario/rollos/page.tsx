import { Suspense } from 'react';
import { LoadingState } from '@/components/ui/LoadingState';
import { RollosClient } from '@/components/inventario/RollosClient';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function RollosPage() {
  return (
    <div className="p-8 max-w-5xl">
      <PageHeader eyebrow="Inventario" title="Rollos" subtitle="Vista plana de todos los rollos con su peso y costo." />
      {/* El filtro de estado va en la query (useSearchParams) → Suspense obligatorio. */}
      <Suspense fallback={<LoadingState />}>
        <RollosClient />
      </Suspense>
    </div>
  );
}
