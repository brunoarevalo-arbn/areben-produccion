import { PageHeader } from '@/components/ui/PageHeader';
import { CatalogosCosto } from '@/components/costos/CatalogosCosto';

export default function CatalogosCostoPage() {
  return (
    <div className="p-8">
      <PageHeader eyebrow="Costos" title="Catálogos" subtitle="Catálogos de referencia para el costeo." />
      <CatalogosCosto />
    </div>
  );
}
