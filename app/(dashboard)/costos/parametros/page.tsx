import { PageHeader } from '@/components/ui/PageHeader';
import { Parametros } from '@/components/costos/Parametros';

export default function ParametrosPage() {
  return (
    <div className="p-8">
      <PageHeader eyebrow="Costos" title="Parámetros de costo" subtitle="Gastos del taller, costureras, márgenes y estampería." />
      <Parametros />
    </div>
  );
}
