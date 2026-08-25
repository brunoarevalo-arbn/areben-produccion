import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Escandallos } from '@/components/costos/Escandallos';
import { LoadingState } from '@/components/ui/LoadingState';

export default function CostosPage() {
  return (
    <div className="p-8">
      <PageHeader eyebrow="Costos" title="Escandallos" subtitle="Costo final de cada producto liso del taller." />
      {/* La solapa y los filtros viven en la query (useSearchParams) → Suspense obligatorio. */}
      <Suspense fallback={<LoadingState />}>
        <Escandallos />
      </Suspense>
    </div>
  );
}
