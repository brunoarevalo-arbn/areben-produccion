import { RollosClient } from '@/components/insumos/RollosClient';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function RollosPage() {
  return (
    <div className="p-8 max-w-5xl">
      <PageHeader eyebrow="Inventario" title="Rollos" subtitle="Vista plana de todos los rollos con su peso y costo." />
      <RollosClient />
    </div>
  );
}
