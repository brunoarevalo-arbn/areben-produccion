import { PageHeader } from '@/components/ui/PageHeader';
import { ComisionesClient } from '@/components/precios/ComisionesClient';

export const dynamic = 'force-dynamic';

export default function ComisionesPage() {
  return (
    <div className="p-8">
      <PageHeader eyebrow="Precios" title="Comisiones y medios de pago" subtitle="Impuestos, comisiones y costos por forma de pago y canal." />
      <ComisionesClient />
    </div>
  );
}
