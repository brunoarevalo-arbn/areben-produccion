import { MovimientosClient } from '@/components/inventario/MovimientosClient';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function MovimientosPage() {
  return (
    <div className="p-8 max-w-5xl">
      <PageHeader eyebrow="Inventario" title="Movimientos" subtitle="Auditoria completa de todos los movimientos de insumos." />
      <MovimientosClient />
    </div>
  );
}
