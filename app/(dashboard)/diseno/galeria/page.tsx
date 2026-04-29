import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export default async function GaleriaPage() {
  const fotos = await prisma.foto.findMany({
    include: { producto: { select: { id: true, nombre: true, marca: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-violet-500">Diseño</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Galería</h1>
        <p className="text-stone-500 text-sm mt-1">{fotos.length} fotos en total</p>
      </div>

      {fotos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-16 text-center">
          <div className="text-5xl mb-4">📷</div>
          <h2 className="text-lg font-semibold text-stone-700 mb-2">Galería vacía</h2>
          <p className="text-stone-400 text-sm">Las fotos aparecerán aquí cuando cargues imágenes en tus productos.</p>
        </div>
      ) : (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
          {fotos.map((foto) => (
            <Link key={foto.id} href={`/diseno/${foto.producto.id}`} className="block break-inside-avoid group">
              <div className="relative overflow-hidden rounded-xl">
                <img
                  src={foto.url}
                  alt={foto.nombre ?? foto.producto.nombre}
                  className="w-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/40 transition-colors flex items-end p-3 opacity-0 group-hover:opacity-100">
                  <p className="text-white text-xs font-semibold">{foto.producto.nombre}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
