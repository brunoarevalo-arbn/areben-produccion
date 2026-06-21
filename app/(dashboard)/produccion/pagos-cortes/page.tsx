import { PagosCortesClient } from '@/components/produccion/PagosCortesClient';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function PagosCortesPage() {
  return (
    <div className="p-8 max-w-6xl">
      <PageHeader
        eyebrow="Produccion"
        title="Pagos de cortes"
        subtitle="Registra pagos masivos a cortadores. Seleccioná los cortes pendientes y agrupalos en un solo pago."
      />
      <PagosCortesClient />
    </div>
  );
}
