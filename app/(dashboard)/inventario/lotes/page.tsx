import { LotesClient } from '@/components/insumos/LotesClient';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function LotesPage() {
  return (
    <div className="p-8 max-w-5xl">
      <PageHeader eyebrow="Inventario" title="Lotes" subtitle="Etiquetas, badanas, hilos y otros insumos trazados por lote." />
      <LotesClient />
    </div>
  );
}
