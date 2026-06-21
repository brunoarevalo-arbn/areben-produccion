import { MuestrasClient } from '@/components/produccion/MuestrasClient';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default function MuestrasPage() {
  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        eyebrow="Producción"
        title="Muestras"
        subtitle="Registrá la tela que se retira del stock para hacer una muestra. Se descuenta del rollo elegido."
      />
      <MuestrasClient />
    </div>
  );
}
