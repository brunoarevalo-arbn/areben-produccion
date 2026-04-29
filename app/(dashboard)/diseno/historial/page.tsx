import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export default async function HistorialPage() {
  const historial = await prisma.historialDiseno.findMany({
    include: { producto: { select: { id: true, nombre: true, marca: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-violet-500">Diseño</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Historial de cambios</h1>
        <p className="text-stone-500 text-sm mt-1">Últimas {historial.length} modificaciones</p>
      </div>

      {historial.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-stone-400 text-sm">El historial aparecerá aquí cuando edites productos.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {historial.map((h) => (
            <div key={h.id} className="bg-white rounded-xl border border-stone-200 px-5 py-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  v{h.version}
                </div>
                <div>
                  <Link href={`/diseno/${h.producto.id}`} className="font-semibold text-stone-800 text-sm hover:text-violet-700 transition">
                    {h.producto.nombre}
                  </Link>
                  {h.producto.marca && (
                    <span className="text-stone-400 text-xs ml-2">{h.producto.marca}</span>
                  )}
                  {h.cambios && (
                    <p className="text-stone-500 text-xs mt-0.5">{h.cambios}</p>
                  )}
                  <p className="text-stone-400 text-xs mt-0.5">por {h.creadoPor}</p>
                </div>
              </div>
              <time className="text-xs text-stone-400 shrink-0">
                {new Date(h.createdAt).toLocaleDateString('es-AR')}
              </time>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
