import { OrdenesEstampaClient } from '@/components/produccion/reposicion/OrdenesEstampaClient';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function OrdenesEstampaPage() {
  return (
    <div className="p-8 max-w-4xl">
      <PageHeader eyebrow="Reposición" title="Órdenes de estampa" subtitle="Cargá lo que se va estampando (parcial), confirmá y generá el remito al terminar." />
      <OrdenesEstampaClient />
    </div>
  );
}
