import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { TerminarLoteForm } from '@/components/produccion/TerminarLoteForm';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default async function TerminarLotePage({ params }: { params: Promise<{ loteId: string }> }) {
  const { loteId } = await params;

  const lote = await prisma.loteProduccion.findUnique({
    where: { id: loteId },
    include: {
      ordenes: {
        where: { estado: 'COSTURA' },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, sku: true, descripcion: true, cantidad: true,
          cortesPorTalle: { orderBy: { talle: 'asc' }, select: { talle: true, cantidad: true } },
        },
      },
    },
  });

  if (!lote) notFound();
  const titulo = lote.descripcion || lote.prenda || 'Lote';

  if (lote.ordenes.length === 0) {
    return (
      <div className="p-8 max-w-4xl">
        <PageHeader eyebrow="Produccion / Terminar lote" title={titulo} subtitle={lote.marca} />
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <p className="text-sm text-amber-800">No hay colores de este lote en costura.</p>
        </div>
        <Link href="/produccion" className="inline-block mt-4 px-4 py-2.5 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition">
          Volver a producción
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        eyebrow="Produccion / Terminar lote"
        title={titulo}
        subtitle={`${lote.marca} · ${lote.ordenes.length} ${lote.ordenes.length === 1 ? 'color' : 'colores'} en costura`}
      />
      <TerminarLoteForm
        loteId={lote.id}
        ordenes={lote.ordenes.map((o) => ({
          id: o.id,
          sku: o.sku,
          descripcion: o.descripcion,
          cantidad: o.cantidad,
          cortes: o.cortesPorTalle.map((c) => ({ talle: c.talle, cantidad: c.cantidad })),
        }))}
      />
    </div>
  );
}
