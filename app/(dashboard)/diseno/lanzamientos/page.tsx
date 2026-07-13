import { PageHeader } from '@/components/ui/PageHeader';
import { LanzamientosClient } from '@/components/diseno/LanzamientosClient';

export const dynamic = 'force-dynamic';

export default function LanzamientosPage() {
  return (
    <div className="p-8">
      <PageHeader eyebrow="Diseño" title="Lanzamientos" subtitle="Diseños confirmados que ya se vienen. Cargalos como foto para que todo el equipo los vea." />
      <LanzamientosClient />
    </div>
  );
}
