import { LotesClient } from '@/components/insumos/LotesClient';

export const dynamic = 'force-dynamic';

export default function LotesPage() {
  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Inventario</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Lotes</h1>
        <p className="text-stone-500 text-sm mt-1">Etiquetas, badanas, hilos y otros insumos trazados por lote.</p>
      </div>
      <LotesClient />
    </div>
  );
}
