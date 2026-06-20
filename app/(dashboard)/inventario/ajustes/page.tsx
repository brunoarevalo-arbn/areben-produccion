import { AjusteForm } from '@/components/insumos/AjusteForm';

export const dynamic = 'force-dynamic';

export default function AjustesPage() {
  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Inventario</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Ajuste Fisico</h1>
        <p className="text-stone-500 text-sm mt-1">Carga ajustes manuales de stock (descarte, correccion de inventario).</p>
      </div>
      <AjusteForm />
    </div>
  );
}
