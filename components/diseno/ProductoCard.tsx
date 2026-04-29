import Link from 'next/link';
import { Producto } from '@/types/diseno';

const ESTADO_STYLE: Record<string, string> = {
  borrador:   'bg-stone-100 text-stone-500',
  activo:     'bg-emerald-100 text-emerald-700',
  archivado:  'bg-red-100 text-red-500',
};

export function ProductoCard({ producto }: { producto: Producto }) {
  const foto = producto.fotos?.[0];

  return (
    <Link href={`/diseno/${producto.id}`} className="group block">
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        {/* Imagen o placeholder */}
        <div className="h-40 bg-stone-100 flex items-center justify-center overflow-hidden">
          {foto ? (
            <img src={foto.url} alt={producto.nombre} className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl text-stone-300">👗</span>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-stone-900 text-sm leading-tight group-hover:text-violet-700 transition-colors">
              {producto.nombre}
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${ESTADO_STYLE[producto.estado] ?? ESTADO_STYLE.borrador}`}>
              {producto.estado}
            </span>
          </div>

          {producto.marca && (
            <p className="text-xs text-stone-400 mb-2">{producto.marca} {producto.temporada ? `· ${producto.temporada}` : ''}</p>
          )}

          <div className="flex gap-3 text-xs text-stone-500 border-t border-stone-100 pt-2 mt-2">
            {producto.tela && <span>🧵 {producto.tela}</span>}
            {producto.costoTotal > 0 && (
              <span className="ml-auto font-semibold text-stone-700">
                ${producto.costoTotal.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
