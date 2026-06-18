import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CORTE: 'En corte',
  COSTURA: 'En costura',
  TERMINADO_SIN_ESTAMPA: 'Sin estampa',
  ESTAMPA: 'En estampa',
  CONTROL_CALIDAD: 'Control calidad',
  CERRADA: 'Cerrada',
};
const ESTADO_COLOR: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700',
  CORTE: 'bg-blue-100 text-blue-700',
  COSTURA: 'bg-violet-100 text-violet-700',
  TERMINADO_SIN_ESTAMPA: 'bg-stone-100 text-stone-600',
  ESTAMPA: 'bg-fuchsia-100 text-fuchsia-700',
  CONTROL_CALIDAD: 'bg-cyan-100 text-cyan-700',
  CERRADA: 'bg-emerald-100 text-emerald-700',
};

function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ESTADO_COLOR[estado] ?? 'bg-stone-100 text-stone-600'}`}>
      {ESTADO_LABEL[estado] ?? estado}
    </span>
  );
}

export default async function FichasPage() {
  const ordenes = await prisma.ordenProduccion.findMany({
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true, sku: true, descripcion: true, marca: true, cantidad: true,
      estado: true, fichaCorteCargada: true, createdAt: true,
    },
  });

  const pendientes = ordenes.filter((o) => !o.fichaCorteCargada && o.estado !== 'CERRADA');
  const conSku = ordenes.filter((o) => o.sku);

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Producción</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Fichas de corte</h1>
        <p className="text-stone-500 text-sm mt-1">
          Fichas pendientes de cargar y todos los SKU en producción, en un solo lugar.
        </p>
      </div>

      {/* Fichas pendientes */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-stone-900 mb-1">
          Fichas pendientes de cargar
          {pendientes.length > 0 && <span className="ml-2 text-sm font-semibold text-amber-600">({pendientes.length})</span>}
        </h2>
        <p className="text-stone-500 text-sm mb-4">Órdenes que todavía no tienen su ficha de corte registrada.</p>

        {pendientes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-10 text-center">
            <p className="text-stone-400 text-sm">No hay fichas pendientes. 🎉</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
            {pendientes.map((o) => (
              <div key={o.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {o.sku
                      ? <span className="font-mono text-xs bg-stone-100 px-2 py-0.5 rounded text-stone-700">{o.sku}</span>
                      : <span className="text-xs text-stone-400 italic">sin SKU</span>}
                    <span className="text-xs text-stone-400">{o.marca}</span>
                    <EstadoBadge estado={o.estado} />
                  </div>
                  {o.descripcion && <p className="text-sm text-stone-600 mt-1 truncate">{o.descripcion}</p>}
                </div>
                <span className="text-xs text-stone-400 tabular-nums shrink-0">{o.cantidad} u</span>
                <Link href={`/produccion/${o.id}/corte`}
                  className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold transition">
                  Cargar ficha
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SKU en producción */}
      <section>
        <h2 className="text-lg font-bold text-stone-900 mb-1">SKU en producción</h2>
        <p className="text-stone-500 text-sm mb-4">Todas las órdenes con SKU generado. Entrá a cada una para ver o editar su ficha.</p>

        {conSku.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-10 text-center">
            <p className="text-stone-400 text-sm">No hay SKU en producción todavía.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
            {conSku.map((o) => (
              <Link key={o.id} href={`/produccion/${o.id}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-stone-50 transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs bg-stone-100 px-2 py-0.5 rounded text-stone-700">{o.sku}</span>
                    <span className="text-xs text-stone-400">{o.marca}</span>
                    <EstadoBadge estado={o.estado} />
                  </div>
                  {o.descripcion && <p className="text-sm text-stone-600 mt-1 truncate">{o.descripcion}</p>}
                </div>
                <span className="text-xs text-stone-400 tabular-nums shrink-0">{o.cantidad} u</span>
                {o.fichaCorteCargada
                  ? <span className="shrink-0 text-xs font-semibold text-emerald-600">✓ ficha</span>
                  : <span className="shrink-0 text-xs font-semibold text-amber-500">sin ficha</span>}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
