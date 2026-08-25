import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { RegistrarCorteConCopia } from '@/components/produccion/RegistrarCorteConCopia';
import { CorteEditor } from '@/components/produccion/CorteEditor';
import type { FichaData } from '@/components/produccion/RegistrarCorteForm';
import { PageHeader } from '@/components/ui/PageHeader';
import { consumoNetoPorRollo } from '@/lib/produccion/consumo';

export const dynamic = 'force-dynamic';

export default async function CortePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ volverA?: string }> }) {
  const { id } = await params;
  const { volverA } = await searchParams;

  const orden = await prisma.ordenProduccion.findUnique({
    where: { id },
    include: {
      cortesPorTalle: { orderBy: { talle: 'asc' } },
      avios: { select: { etiquetaId: true, cantidad: true } },
      // Si el corte está imputado, el aviso va ANTES del formulario (no al guardar).
      pagoCorte: { select: { id: true, fecha: true, montoTotal: true, cortadorId: true, cortador: { select: { nombre: true } } } },
      movimientosInsumo: {
        where: { rolloId: { not: null } },
        include: { rollo: { select: { insumo: { select: { unidadDefault: true, rinde: true } } } } },
      },
    },
  });

  if (!orden) notFound();

  const { kg: kgTotal, metros: metrosTotal, porRollo } = consumoNetoPorRollo(
    orden.movimientosInsumo.map((m) => ({ rolloId: m.rolloId, cantidad: Number(m.cantidad), unidadDefault: m.rollo?.insumo.unidadDefault ?? null, rinde: m.rollo?.insumo.rinde ? Number(m.rollo.insumo.rinde) : null })),
  );
  const metrosPorU = orden.cantidad > 0 ? metrosTotal / orden.cantidad : 0;
  const kgPorU = orden.cantidad > 0 ? kgTotal / orden.cantidad : 0;
  // Metros realmente consumidos por rollo (para mostrar solo lo consumido en "Tela por tizada").
  const consumidoPorRollo: Record<string, number> = {};
  for (const [rolloId, v] of porRollo) {
    const u = (v.unidadDefault || '').toLowerCase();
    consumidoPorRollo[rolloId] = u.includes('kg') ? v.consumo * (v.rinde || 0) : v.consumo;
  }

  // Detalle guardado del form (para ver/editar idéntico). Puede faltar en fichas viejas.
  const fichaData = (orden.fichaCorteData ?? null) as FichaData | null;
  // Pre-carga del cortador (tizadas/talles/precio sin rollo) → la diseñadora asigna la tela.
  // El cortador ya asignado (desde la cola o por ser el predeterminado) viaja SIEMPRE:
  // sin esto el select del form arrancaba vacío y había que reelegirlo a mano. Si además
  // hay ficha guardada, el cortador de la ficha gana (el form resuelve fichaData primero).
  const preCargaCortador = (orden.corteEstado === 'cargado' || orden.corteEstado === 'validado') && fichaData
    ? { fichaData, cortadorId: orden.cortadorId }
    : orden.cortadorId
      ? { cortadorId: orden.cortadorId }
      : undefined;

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
        <PageHeader eyebrow="Producción / Corte" title={orden.sku ?? ''} />
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
          volverA={volverA}
          pago={orden.pagoCorte ? {
            id: orden.pagoCorte.id,
            fecha: orden.pagoCorte.fecha.toISOString(),
            monto: Number(orden.pagoCorte.montoTotal),
            cortador: orden.pagoCorte.cortador?.nombre ?? orden.cortador,
            cortadorId: orden.pagoCorte.cortadorId ?? orden.cortadorId,
          } : null}
          consumidoPorRollo={consumidoPorRollo}
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
        eyebrow="Producción / Registrar corte"
        title={orden.sku ?? ''}
        subtitle={`${orden.descripcion || orden.marca} · Planificadas: ${orden.cantidad} unidades`}
      />
      <RegistrarCorteConCopia ordenId={orden.id} sku={orden.sku ?? ''} cantidadPlanificada={orden.cantidad} marca={orden.marca} hermanas={hermanas} volverA={volverA} initialPrefill={preCargaCortador} />
    </div>
  );
}
