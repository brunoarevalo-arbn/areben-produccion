import { QueEstamparClient } from '@/components/produccion/reposicion/QueEstamparClient';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function QueEstamparPage() {
  return (
    <div className="p-8 max-w-4xl">
      <PageHeader eyebrow="Reposición" title="Qué estampar" subtitle="Stock de tus productos producidos vs el mínimo. Generá la orden de estampa desde acá." />
      <QueEstamparClient />
    </div>
  );
}
