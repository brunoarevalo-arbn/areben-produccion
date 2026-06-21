import { AjusteForm } from '@/components/insumos/AjusteForm';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function AjustesPage() {
  return (
    <div className="p-8 max-w-5xl">
      <PageHeader
        eyebrow="Inventario"
        title="Ajuste Fisico"
        subtitle="Carga ajustes manuales de stock (descarte, correccion de inventario)."
      />
      <AjusteForm />
    </div>
  );
}
