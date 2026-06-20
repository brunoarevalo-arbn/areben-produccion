import { StockTerminadoClient } from '@/components/produccion/StockTerminadoClient';
import { AjusteTerminadoForm } from '@/components/produccion/AjusteTerminadoForm';

export const dynamic = 'force-dynamic';

export default function StockTerminadoPage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Inventario</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Producto terminado</h1>
        <p className="text-stone-500 text-sm mt-1">
          Stock de prendas por SKU y talle. Entra por producción; podés ajustarlo a mano.
        </p>
      </div>
      <StockTerminadoClient />
      <div className="mt-8">
        <AjusteTerminadoForm />
      </div>
    </div>
  );
}
