import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { calcularEstado, ESTADO_LABEL, ESTADO_COLOR } from '@/lib/diseno/estado';

export const dynamic = 'force-dynamic';

export default async function ProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proyecto = await prisma.proyectoDiseno.findUnique({
    where: { id },
    include: {
      iteraciones: { select: { estado: true } },
      fases:       { include: { fase: { select: { orden: true, nombre: true } } } },
    },
  });

  if (!proyecto) notFound();

  const estado = calcularEstado(proyecto);

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/diseno" className="text-xs text-stone-500 hover:text-stone-800 transition">
        ← Volver al Kanban
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">{proyecto.nombre}</h1>
          <p className="text-stone-400 text-sm">{proyecto.marca}</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${ESTADO_COLOR[estado]}`}>
          {ESTADO_LABEL[estado]}
        </span>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <p className="text-sm font-semibold text-amber-800 mb-1">Vista en construcción</p>
        <p className="text-xs text-amber-700">
          La pantalla nueva del proyecto (inspiración, muestras, fases con responsables) llega en el próximo commit. Por ahora podés crear y archivar proyectos desde el Kanban.
        </p>
      </div>

      {proyecto.inspiracion && (
        <div className="mt-5 bg-white border border-stone-200 rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Inspiración</p>
          <p className="text-sm text-stone-700 whitespace-pre-wrap">{proyecto.inspiracion}</p>
        </div>
      )}
    </div>
  );
}
