import { prisma } from '@/lib/prisma';
import { MotivosDescarteManager } from '@/components/configuracion/MotivosDescarteManager';

export const dynamic = 'force-dynamic';

export default async function MotivosPage() {
  const motivos = await prisma.motivoDescarte.findMany({
    orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
  });
  const serialized = JSON.parse(JSON.stringify(motivos));

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Configuracion</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Motivos de descarte</h1>
        <p className="text-stone-500 text-sm mt-1">
          Categorias estructuradas para tracking de merma por proveedor / corte / costura / estampa.
        </p>
      </div>
      <MotivosDescarteManager initial={serialized} />
    </div>
  );
}
