import { prisma } from '@/lib/prisma';
import { ProveedoresManager } from '@/components/configuracion/ProveedoresManager';

export const dynamic = 'force-dynamic';

export default async function ProveedoresPage() {
  const proveedores = await prisma.proveedor.findMany({
    orderBy: { nombre: 'asc' },
  });

  const serialized = JSON.parse(JSON.stringify(proveedores));

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Configuracion</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Proveedores</h1>
        <p className="text-stone-500 text-sm mt-1">Administra los proveedores de insumos.</p>
      </div>
      <ProveedoresManager initial={serialized} />
    </div>
  );
}
