import Link from 'next/link';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { KanbanDiseno } from '@/components/diseno/KanbanDiseno';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
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
      <PageHeader
        eyebrow="Diseño"
        title="Diseño"
        subtitle={`${items.filter((p) => !p.archivado).length} proyecto${items.filter((p) => !p.archivado).length !== 1 ? 's' : ''} activo${items.filter((p) => !p.archivado).length !== 1 ? 's' : ''}`}
        actions={
          <>
            <Link href="/diseno/fases-catalogo"
              className="text-xs px-3 py-2 rounded-xl border border-stone-200 text-stone-600 hover:border-stone-400 transition">
              Fases
            </Link>
            <Link href="/diseno/molderias"
              className="text-xs px-3 py-2 rounded-xl border border-stone-200 text-stone-600 hover:border-stone-400 transition">
              Molderías
            </Link>
          </>
        }
      />

      {/* La columna de archivados vive en la query (useSearchParams) → Suspense. */}
      <Suspense fallback={<LoadingState />}>
        <KanbanDiseno proyectos={items} />
      </Suspense>
    </div>
  );
}
