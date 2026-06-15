import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { KanbanDiseno } from '@/components/diseno/KanbanDiseno';
import { calcularEstado, faseActual } from '@/lib/diseno/estado';

export const dynamic = 'force-dynamic';

export default async function DisenoPage() {
  const proyectos = await prisma.proyectoDiseno.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      iteraciones: { select: { estado: true } },
      fases:       { include: { fase: { select: { orden: true, nombre: true } } } },
    },
  });

  const items = proyectos.map((p) => ({
    id:          p.id,
    nombre:      p.nombre,
    marca:       p.marca,
    inspiracion: p.inspiracion,
    moodboard:   p.moodboard,
    archivado:   p.archivado,
    updatedAt:   p.updatedAt.toISOString(),
    estado:      calcularEstado(p),
    faseActual:  faseActual(p),
  }));

  return (
    <div className="p-6 max-w-[1400px]">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-violet-500">Módulo 1</span>
          <h1 className="text-2xl font-bold text-stone-900 mt-1">Diseño</h1>
          <p className="text-stone-500 text-sm mt-1">{items.filter((p) => !p.archivado).length} proyecto{items.filter((p) => !p.archivado).length !== 1 ? 's' : ''} activo{items.filter((p) => !p.archivado).length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/diseno/fases-catalogo"
            className="text-xs px-3 py-2 rounded-xl border border-stone-200 text-stone-600 hover:border-stone-400 transition">
            Fases
          </Link>
          <Link href="/diseno/molderias"
            className="text-xs px-3 py-2 rounded-xl border border-stone-200 text-stone-600 hover:border-stone-400 transition">
            Molderías
          </Link>
        </div>
      </div>

      <KanbanDiseno proyectos={items} />
    </div>
  );
}
