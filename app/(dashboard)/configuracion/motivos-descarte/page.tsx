import { prisma } from '@/lib/prisma';
import { requirePagina } from '@/lib/page-guard';
import { MotivosDescarteManager } from '@/components/configuracion/MotivosDescarteManager';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default async function MotivosPage() {
  await requirePagina('motivos');
  const motivos = await prisma.motivoDescarte.findMany({
    orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
  });
  const serialized = JSON.parse(JSON.stringify(motivos));

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader eyebrow="Producción" title="Motivos de descarte" subtitle="Categorias estructuradas para tracking de merma por proveedor / corte / costura / estampa." />
      <MotivosDescarteManager initial={serialized} />
    </div>
  );
}
