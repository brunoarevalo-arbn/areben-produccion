import { ReposicionClient } from '@/components/produccion/ReposicionClient';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function ReposicionPage() {
  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        eyebrow="Producción"
        title="Reposición"
        subtitle="Qué producir según el stock de Gestión Nube (productos propios) + tus lisos en areben."
      />
      <ReposicionClient />
    </div>
  );
}
