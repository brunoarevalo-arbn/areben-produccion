import { PageHeader } from '@/components/ui/PageHeader';
import { SaleClient } from '@/components/precios/SaleClient';

export const dynamic = 'force-dynamic';

export default function SalePage() {
  return (
    <div className="p-8">
      <PageHeader eyebrow="Precios" title="Descuentos / Sale" subtitle="Probá rebajas y mirá el margen neto real según la forma de pago. Confirmá y exportá los precios promocionales." />
      <SaleClient />
    </div>
  );
}
