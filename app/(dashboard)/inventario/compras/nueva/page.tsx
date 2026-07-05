import { NuevaCompraForm } from '@/components/inventario/NuevaCompraForm';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function NuevaCompraPage() {
  return (
    <div className="p-8 max-w-5xl">
      <PageHeader
        eyebrow="Compras"
        title="Nueva compra de tela"
        subtitle="Registrá una compra que genera stock (líneas y rollos)."
      />
      <NuevaCompraForm />
    </div>
  );
}
