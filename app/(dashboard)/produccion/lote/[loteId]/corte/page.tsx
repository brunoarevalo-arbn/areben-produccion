import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

// Cortar lote = cortar cada color con la ficha del SKU (misma lógica que un corte suelto).
// El primer color se carga completo; los siguientes copian su ficha (avíos, cortador,
// costo, talles y rinde) y solo se elige el rollo del color.
export default async function CortarLotePage({ params }: { params: Promise<{ loteId: string }> }) {
  const { loteId } = await params;

  const lote = await prisma.loteProduccion.findUnique({
    where: { id: loteId },
    include: {
      ordenes: {
        where: { estado: { not: 'CERRADA' } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, sku: true, descripcion: true, cantidad: true, fichaCorteCargada: true },
      },
    },
  });
  if (!lote) notFound();

  const titulo = lote.descripcion || lote.prenda || 'Lote';
  const pendientes = lote.ordenes.filter((o) => !o.fichaCorteCargada);
  const algunaCargada = lote.ordenes.some((o) => o.fichaCorteCargada);

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader
        eyebrow="Producción / Cortar lote"
        title={titulo}
        subtitle={`${lote.marca} · ${lote.ordenes.length} ${lote.ordenes.length === 1 ? 'color' : 'colores'}`}
      />

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-900 mb-4">
        Cada color se corta con su ficha. {algunaCargada ? 'En los que faltan, ' : 'Cargá el primer color completo; después, '}
        al abrir la ficha vas a poder <strong>copiar la de un color ya cargado</strong> (avíos, cortador, costo, talles y rinde) y solo elegir el rollo de ese color.
      </div>

      {pendientes.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-4 text-sm text-emerald-800">
          Todos los colores de este lote ya tienen ficha cargada. ✓
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
        {lote.ordenes.map((o) => (
          <div key={o.id} className="flex items-center gap-3 px-5 py-3.5">
            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs bg-stone-100 px-2 py-0.5 rounded text-stone-700">{o.sku ?? 'S/SKU'}</span>
              {o.descripcion && <span className="text-sm text-stone-500 truncate">{o.descripcion}</span>}
              {o.fichaCorteCargada && <span className="text-xs font-semibold text-emerald-600">✓ ficha</span>}
            </div>
            <span className="text-xs text-stone-400 tabular-nums shrink-0">{o.cantidad} u</span>
            {o.fichaCorteCargada ? (
              <Link href={`/produccion/${o.id}/ficha`} className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-100 font-semibold transition">Ver ficha</Link>
            ) : (
              <Link href={`/produccion/${o.id}/corte?volverA=${encodeURIComponent(`/produccion/lote/${loteId}/corte`)}`} className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold transition">Cargar ficha</Link>
            )}
          </div>
        ))}
      </div>

      <Link href="/produccion" className="inline-block mt-4 px-4 py-2.5 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition">
        Volver a producción
      </Link>
    </div>
  );
}
