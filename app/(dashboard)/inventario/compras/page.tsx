import { ComprasClient } from '@/components/insumos/ComprasClient';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function ComprasPage() {
  return (
    <div className="p-8 max-w-5xl">
      <PageHeader
        eyebrow="Inventario"
        title="Compras"
        subtitle="Historial de compras a proveedores con estado de pago."
      />
      <ComprasClient />
    </div>
  );
}
