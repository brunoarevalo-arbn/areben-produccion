import { ReposicionClient } from '@/components/produccion/ReposicionClient';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function ReposicionPage() {
  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        eyebrow="Reposición"
        title="Reposición"
        subtitle="Vínculos con Gestión Nube y qué producir según el stock (productos propios) + tus lisos."
      />
      <ReposicionClient />
    </div>
  );
}
