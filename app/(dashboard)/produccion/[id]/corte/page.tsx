import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { RegistrarCorteConCopia } from '@/components/produccion/RegistrarCorteConCopia';
import { CorteEditor } from '@/components/produccion/CorteEditor';
import type { FichaData } from '@/components/produccion/RegistrarCorteForm';
import { PageHeader } from '@/components/ui/PageHeader';
import { resumenConsumoTela } from '@/lib/produccion/consumo';

export const dynamic = 'force-dynamic';

export default async function CortePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ volverA?: string }> }) {
  const { id } = await params;
  const { volverA } = await searchParams;

  const orden = await prisma.ordenProduccion.findUnique({
    where: { id },
    include: {
      cortesPorTalle: { orderBy: { talle: 'asc' } },
      avios: { select: { etiquetaId: true, cantidad: true } },
      movimientosInsumo: {
        where: { rolloId: { not: null } },
        include: { rollo: { select: { insumo: { select: { unidadDefault: true, rinde: true } } } } },
      },
    },
  });

  if (!orden) notFound();

  const { kg: kgTotal, metros: metrosTotal } = resumenConsumoTela(
    orden.movimientosInsumo.map((m) => ({ rolloId: m.rolloId, cantidad: Number(m.cantidad), unidadDefault: m.rollo?.insumo.unidadDefault ?? null, rinde: m.rollo?.insumo.rinde ? Number(m.rollo.insumo.rinde) : null })),
  );
  const metrosPorU = orden.cantidad > 0 ? metrosTotal / orden.cantidad : 0;
  const kgPorU = orden.cantidad > 0 ? kgTotal / orden.cantidad : 0;

  // Detalle guardado del form (para ver/editar idéntico). Puede faltar en fichas viejas.
  const fichaData = (orden.fichaCorteData ?? null) as FichaData | null;

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
        <CorteEditor
          ordenId={orden.id}
          sku={orden.sku ?? ''}
          cantidadPlanificada={orden.cantidad}
          marca={orden.marca}
          resumen={{
            cantidad: orden.cantidad, kgTotal, metrosTotal, metrosPorU, kgPorU,
            cortador: orden.cortador,
            fechaCorte: orden.fechaCorte ? orden.fechaCorte.toISOString().slice(0, 10) : null,
            talles: orden.cortesPorTalle.map((c) => ({ talle: c.talle, cantidad: c.cantidad })),
          }}
          fichaData={fichaData}
          prefill={fichaData
            ? { fichaData }
            : {
                talles: orden.cortesPorTalle.map((c) => ({ talle: c.talle, cantidad: c.cantidad })),
                avios: orden.avios.map((a) => ({ etiquetaId: a.etiquetaId, cantidad: a.cantidad })),
                cortadorId: orden.cortadorId,
                costoCorte: Number(orden.costoCorte) || undefined,
              }}
        />
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
      <RegistrarCorteConCopia ordenId={orden.id} sku={orden.sku ?? ''} cantidadPlanificada={orden.cantidad} marca={orden.marca} hermanas={hermanas} volverA={volverA} />
    </div>
  );
}
