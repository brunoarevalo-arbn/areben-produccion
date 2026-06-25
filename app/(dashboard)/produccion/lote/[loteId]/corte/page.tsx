import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CortarLoteForm } from '@/components/produccion/CortarLoteForm';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default async function CortarLotePage({ params }: { params: Promise<{ loteId: string }> }) {
  const { loteId } = await params;

  const lote = await prisma.loteProduccion.findUnique({
    where: { id: loteId },
    include: {
      ordenes: {
        where: { estado: { not: 'CERRADA' } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, sku: true, descripcion: true, marca: true, cantidad: true, fichaCorteCargada: true },
      },
    },
  });

  if (!lote) notFound();

  const pendientes = lote.ordenes.filter((o) => !o.fichaCorteCargada);
  const yaCortados = lote.ordenes.filter((o) => o.fichaCorteCargada);
  const titulo = lote.descripcion || lote.prenda || 'Lote';

  if (pendientes.length === 0) {
    return (
      <div className="p-8 max-w-4xl">
        <PageHeader eyebrow="Produccion / Cortar lote" title={titulo} subtitle={lote.marca} />
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
          <p className="text-sm text-emerald-800">Todos los colores de este lote ya tienen ficha cargada.</p>
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
        eyebrow="Produccion / Cortar lote"
        title={titulo}
        subtitle={`${lote.marca} · ${pendientes.length} ${pendientes.length === 1 ? 'color' : 'colores'} por cortar`}
      />
      {yaCortados.length > 0 && (
        <p className="text-xs text-stone-400 mb-4">
          {yaCortados.length} {yaCortados.length === 1 ? 'color ya tiene' : 'colores ya tienen'} ficha cargada y no se muestran.
        </p>
      )}
      <CortarLoteForm
        loteId={lote.id}
        marca={lote.marca}
        ordenes={pendientes.map((o) => ({ id: o.id, sku: o.sku, descripcion: o.descripcion, cantidad: o.cantidad }))}
      />
    </div>
  );
}
