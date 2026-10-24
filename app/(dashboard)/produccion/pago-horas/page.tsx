import { redirect } from 'next/navigation';
import { requirePagina } from '@/lib/page-guard';
import { PageHeader } from '@/components/ui/PageHeader';
import { PagoHorasClient } from '@/components/produccion/PagoHorasClient';

export const dynamic = 'force-dynamic';

export default async function PagoHorasPage() {
  // Sueldo de una persona: sólo admin. `costos` lo tienen también Lorena y Stefania.
  const session = await requirePagina('costos');
  if (session.rol !== 'admin') redirect('/sin-acceso');
  return (
    <div className="p-8 max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Producción / Pago de horas"
        title="Pago de horas"
        subtitle="Cuánto corresponde pagarle a cada costurera por período, según la tablet."
      />
      <PagoHorasClient />
    </div>
  );
}
