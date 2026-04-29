import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ProyectosLista } from '@/components/diseno/ProyectosLista';

export default async function DisenoPage() {
  const proyectos = await prisma.proyectoDiseno.findMany({
    include: {
      pasos: {
        select: { numeroPaso: true, nombrePaso: true, estado: true },
        orderBy: { numeroPaso: 'asc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const activos = proyectos.filter((p) => p.estado !== 'archivado').length;

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-violet-500">Módulo 1</span>
          <h1 className="text-2xl font-bold text-stone-900 mt-1">Diseño de Indumentaria</h1>
          <p className="text-stone-500 text-sm mt-1">{activos} proyecto{activos !== 1 ? 's' : ''} activo{activos !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/diseno/nuevo"
          className="bg-stone-900 hover:bg-stone-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition"
        >
          + Nuevo proyecto
        </Link>
      </div>

      {proyectos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-16 text-center">
          <div className="text-5xl mb-4">👗</div>
          <h2 className="text-lg font-semibold text-stone-700 mb-2">Sin proyectos todavía</h2>
          <p className="text-stone-400 text-sm mb-6">Creá tu primer diseño para empezar el flujo de producción.</p>
          <Link href="/diseno/nuevo" className="inline-block bg-stone-900 text-white px-6 py-3 rounded-xl text-sm font-semibold">
            Crear primer proyecto
          </Link>
        </div>
      ) : (
        <ProyectosLista proyectos={proyectos.map((p) => ({
          id:          p.id,
          nombre:      p.nombre,
          marca:       p.marca,
          estado:      p.estado ?? 'activo',
          inspiracion: p.inspiracion,
          pasos:       p.pasos,
          createdAt:   p.createdAt,
        }))} />
      )}
    </div>
  );
}
