import { PageHeader } from '@/components/ui/PageHeader';
import { PreciosClient } from '@/components/costos/PreciosClient';

export const dynamic = 'force-dynamic';

export default function PreciosPage() {
  return (
    <div className="p-8">
      <PageHeader eyebrow="Costos" title="Precios" subtitle="Costo, precio de venta y margen por producto de producción propia. Descuento masivo y export a Excel." />
      <PreciosClient />
    </div>
  );
}
