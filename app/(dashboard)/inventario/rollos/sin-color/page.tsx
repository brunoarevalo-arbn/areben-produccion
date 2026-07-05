import { SinColorClient } from '@/components/inventario/SinColorClient';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function SinColorPage() {
  return (
    <div className="p-8 max-w-5xl">
      <PageHeader eyebrow="Inventario" title="Rollos y Lotes sin color" subtitle="Insumos que manejan color pero tienen rollos o lotes sin color asignado. Asignalos manualmente." />
      <SinColorClient />
    </div>
  );
}
