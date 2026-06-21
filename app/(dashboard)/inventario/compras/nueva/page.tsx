import { NuevaCompraForm } from '@/components/insumos/NuevaCompraForm';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function NuevaCompraPage() {
  return (
    <div className="p-8 max-w-5xl">
      <PageHeader
        eyebrow="Inventario"
        title="Nueva Compra"
        subtitle="Registra una compra con lineas, rollos y lotes."
      />
      <NuevaCompraForm />
    </div>
  );
}
