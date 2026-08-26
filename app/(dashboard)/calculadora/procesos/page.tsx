import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { ProcesosClient } from '@/components/calculadora/ProcesosClient';

export const dynamic = 'force-dynamic';

export default function ProcesosPage() {
  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        eyebrow="Calculadora de producción"
        title="Procesos por prenda"
        subtitle="Todos los pasos de una prenda, cada uno con su máquina responsable. No se escriben de memoria: nacen del relevamiento de una corrida y se aprueban acá."
      />
      <Suspense fallback={<LoadingState />}>
        <ProcesosClient />
      </Suspense>
    </div>
  );
}
