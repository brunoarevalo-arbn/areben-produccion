import { PageHeader } from '@/components/ui/PageHeader';
import { Escandallos } from '@/components/costos/Escandallos';

export default function CostosPage() {
  return (
    <div className="p-8">
      <PageHeader eyebrow="Costos" title="Escandallos" subtitle="Costo final de cada producto liso del taller." />
      <Escandallos />
    </div>
  );
}
