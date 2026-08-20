import { PageHeader } from '@/components/ui/PageHeader';
import { ProductosEstampados } from '@/components/costos/ProductosEstampados';

export default function ProductosEstampadosPage() {
  return (
    <div className="p-8">
      <PageHeader eyebrow="Costos" title="Productos con estampa" subtitle="Costo final = liso + estampa(s) + estampería. Si el liso todavía no tiene escandallo, la receta se declara igual y el producto queda sin costo." />
      <ProductosEstampados />
    </div>
  );
}
