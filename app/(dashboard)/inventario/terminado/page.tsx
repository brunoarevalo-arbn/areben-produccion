import { StockTerminadoClient } from '@/components/produccion/StockTerminadoClient';
import { AjusteTerminadoForm } from '@/components/produccion/AjusteTerminadoForm';
import { MovimientosTerminadoClient } from '@/components/produccion/MovimientosTerminadoClient';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function StockTerminadoPage() {
  return (
    <div className="p-8 max-w-4xl">
      <PageHeader eyebrow="Inventario" title="Producto terminado" subtitle="Stock de prendas por SKU y talle. Entra por producción; podés cargar o ajustar a mano." />
      <StockTerminadoClient />
      <div className="mt-6">
        <MovimientosTerminadoClient />
      </div>
      <div className="mt-8">
        <AjusteTerminadoForm />
      </div>
    </div>
  );
}
