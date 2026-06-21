import { prisma } from '@/lib/prisma';
import { CortadoresManager } from '@/components/configuracion/CortadoresManager';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default async function CortadoresPage() {
  const cortadores = await prisma.cortador.findMany({ orderBy: { nombre: 'asc' } });
  const serialized = JSON.parse(JSON.stringify(cortadores));

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader eyebrow="Configuracion" title="Cortadores" subtitle="Administra los cortadores con sus tarifas y datos de contacto." />
      <CortadoresManager initial={serialized} />
    </div>
  );
}
