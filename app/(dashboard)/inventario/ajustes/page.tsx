import { AjusteForm } from '@/components/insumos/AjusteForm';
import { AjusteCostoForm } from '@/components/insumos/AjusteCostoForm';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function AjustesPage() {
  return (
    <div className="p-8 max-w-5xl">
      <PageHeader
        eyebrow="Inventario"
        title="Ajustes"
        subtitle="Corregí a mano el stock o el costo de un insumo, sin cargar una compra."
      />
      <div className="grid md:grid-cols-2 gap-6 items-start">
        <div>
          <h2 className="text-sm font-bold text-stone-700 mb-3">Stock</h2>
          <AjusteForm />
        </div>
        <div>
          <h2 className="text-sm font-bold text-stone-700 mb-3">Costo</h2>
          <AjusteCostoForm />
        </div>
      </div>
    </div>
  );
}
