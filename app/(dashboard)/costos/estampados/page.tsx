import { PageHeader } from '@/components/ui/PageHeader';
import { ProductosEstampados } from '@/components/costos/ProductosEstampados';

export default function ProductosEstampadosPage() {
  return (
    <div className="p-8">
      <PageHeader eyebrow="Costos" title="Productos con estampa" subtitle="Costo final = liso (escandallo) + estampa(s) + estampería." />
      <ProductosEstampados />
    </div>
  );
}
