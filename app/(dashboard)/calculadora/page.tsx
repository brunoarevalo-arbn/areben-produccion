import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { CorridasClient } from '@/components/calculadora/CorridasClient';

export const dynamic = 'force-dynamic';

export default function CalculadoraPage() {
  return (
    <div className="p-8 max-w-5xl">
      <PageHeader
        eyebrow="Calculadora de producción"
        title="Corridas de muestra"
        subtitle="Se enciende una corrida, la costurera la cose en su tablet cronometrando paso por paso, y de ahí salen los minutos y los centímetros de ribete que bajan al escandallo."
      />
      <Suspense fallback={<LoadingState />}>
        <CorridasClient />
      </Suspense>
    </div>
  );
}
