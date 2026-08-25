import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PasajesClient } from '@/components/costos/PasajesClient';
import { LoadingState } from '@/components/ui/LoadingState';

export const dynamic = 'force-dynamic';

export default function PasajesPage() {
  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        eyebrow="Costos"
        title="Pasajes a la marca"
        subtitle="Lo que sale del stock terminado del taller y para la marca es una compra. El total es neto: el costo del escandallo ya viene sin IVA."
      />
      {/* La solapa vive en la query (useSearchParams) → Suspense obligatorio. */}
      <Suspense fallback={<LoadingState />}>
        <PasajesClient />
      </Suspense>
    </div>
  );
}
