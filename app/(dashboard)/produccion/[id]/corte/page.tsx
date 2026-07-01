import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { RegistrarCorteConCopia } from '@/components/produccion/RegistrarCorteConCopia';
import { CorteRevertir } from '@/components/produccion/CorteRevertir';
import { PageHeader } from '@/components/ui/PageHeader';
import { resumenConsumoTela } from '@/lib/produccion/consumo';

export const dynamic = 'force-dynamic';

const fmt = (n: unknown) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

export default async function CortePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const orden = await prisma.ordenProduccion.findUnique({
    where: { id },
    include: {
      cortesPorTalle: { orderBy: { talle: 'asc' } },
      movimientosInsumo: {
        where: { rolloId: { not: null } },
        include: { rollo: { select: { insumo: { select: { unidadDefault: true, rinde: true } } } } },
      },
    },
  });

  if (!orden) notFound();

  const { kg: kgTotal, metros: metrosTotal } = resumenConsumoTela(
    orden.movimientosInsumo.map((m) => ({ cantidad: Number(m.cantidad), unidadDefault: m.rollo?.insumo.unidadDefault ?? null, rinde: m.rollo?.insumo.rinde ? Number(m.rollo.insumo.rinde) : null })),
  );
  const metrosPorU = orden.cantidad > 0 ? metrosTotal / orden.cantidad : 0;
  const kgPorU = orden.cantidad > 0 ? kgTotal / orden.cantidad : 0;

  // Hermanas del mismo lote que ya tienen ficha → se puede copiar la suya.
  const hermanas = orden.loteId
    ? await prisma.ordenProduccion.findMany({
        where: { loteId: orden.loteId, fichaCorteCargada: true, id: { not: orden.id } },
        select: { id: true, sku: true },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  if (orden.fichaCorteCargada) {
    return (
      <div className="p-8 max-w-4xl">
        <PageHeader eyebrow="Produccion / Corte" title={orden.sku ?? ''} />
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-bold text-emerald-800 mb-3">Corte ya registrado</h3>
          <div className="space-y-2 text-sm">
            <p><span className="text-emerald-600">Total cortadas:</span> <strong>{orden.cantidad} unidades</strong></p>
            <p><span className="text-emerald-600">Consumo total:</span> <strong>{kgTotal > 0 ? `${fmt(kgTotal)} kg` : ''}{kgTotal > 0 && metrosTotal > 0 ? ' · ' : ''}{metrosTotal > 0 ? `${fmt(metrosTotal)} m` : ''}{kgTotal === 0 && metrosTotal === 0 ? '--' : ''}</strong></p>
            <p><span className="text-emerald-600">Por unidad:</span> <strong>{metrosPorU > 0 ? `${fmt(metrosPorU)} m/u` : '--'}{kgPorU > 0 ? ` · ${fmt(kgPorU)} kg/u` : ''}</strong></p>
          </div>
          <div className="mt-4 pt-4 border-t border-emerald-200">
            <p className="text-xs text-emerald-700 uppercase tracking-widest font-bold mb-2">Desglose por talle</p>
            <div className="flex flex-wrap gap-3">
              {orden.cortesPorTalle.map((c) => (
                <div key={c.id} className="bg-white rounded-lg px-3 py-1.5 text-sm border border-emerald-200">
                  <span className="text-emerald-600">{c.talle}:</span> <strong>{c.cantidad}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <CorteRevertir ordenId={orden.id} />
          <Link href={`/produccion/${orden.id}`}
            className="px-4 py-2.5 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition">
            Volver al detalle
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        eyebrow="Produccion / Registrar corte"
        title={orden.sku ?? ''}
        subtitle={`${orden.descripcion || orden.marca} · Planificadas: ${orden.cantidad} unidades`}
      />
      <RegistrarCorteConCopia ordenId={orden.id} sku={orden.sku ?? ''} cantidadPlanificada={orden.cantidad} marca={orden.marca} hermanas={hermanas} />
    </div>
  );
}
