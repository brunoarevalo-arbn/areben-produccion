import { prisma } from '@/lib/prisma';
import { CortadoresManager } from '@/components/configuracion/CortadoresManager';

export const dynamic = 'force-dynamic';

export default async function CortadoresPage() {
  const cortadores = await prisma.cortador.findMany({ orderBy: { nombre: 'asc' } });
  const serialized = JSON.parse(JSON.stringify(cortadores));

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Configuracion</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Cortadores</h1>
        <p className="text-stone-500 text-sm mt-1">Administra los cortadores con sus tarifas y datos de contacto.</p>
      </div>
      <CortadoresManager initial={serialized} />
    </div>
  );
}
