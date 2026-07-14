import { PageHeader } from '@/components/ui/PageHeader';
import { ListaPreciosClient } from '@/components/precios/ListaPreciosClient';

export const dynamic = 'force-dynamic';

export default function ListaPreciosPage() {
  return (
    <div className="p-8">
      <PageHeader eyebrow="Precios" title="Lista de precios" subtitle="Costo, precio de venta y margen por producto de producción propia. Descuento masivo y export a Excel." />
      <ListaPreciosClient />
    </div>
  );
}
