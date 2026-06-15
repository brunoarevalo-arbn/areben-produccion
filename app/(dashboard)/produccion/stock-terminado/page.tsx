import { StockTerminadoClient } from '@/components/produccion/StockTerminadoClient';

export const dynamic = 'force-dynamic';

export default function StockTerminadoPage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Producción</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Stock terminado</h1>
        <p className="text-stone-500 text-sm mt-1">
          Productos terminados que salieron de costura, por SKU y talle.
        </p>
      </div>
      <StockTerminadoClient />
    </div>
  );
}
