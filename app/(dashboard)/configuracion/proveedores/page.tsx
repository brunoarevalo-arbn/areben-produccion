import { prisma } from '@/lib/prisma';
import { requirePagina } from '@/lib/page-guard';
import { ProveedoresManager } from '@/components/configuracion/ProveedoresManager';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default async function ProveedoresPage() {
  await requirePagina('proveedores');
  const proveedores = await prisma.proveedor.findMany({
    orderBy: { nombre: 'asc' },
  });

  const serialized = JSON.parse(JSON.stringify(proveedores));

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader eyebrow="Configuración" title="Proveedores" subtitle="Administra los proveedores de insumos." />
      <ProveedoresManager initial={serialized} />
    </div>
  );
}
