import { VincularClient } from '@/components/produccion/reposicion/VincularClient';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function VincularPage() {
  return (
    <div className="p-8 max-w-4xl">
      <PageHeader eyebrow="Reposición" title="Vinculación de productos" subtitle="Asociá cada producto de Gestión Nube con su liso base. Sincronizá el catálogo desde acá." />
      <VincularClient />
    </div>
  );
}
