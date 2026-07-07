import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { CortadorAsignadosAdmin, type OpAsignada } from '@/components/produccion/CortadorAsignadosAdmin';

export const dynamic = 'force-dynamic';

export default async function CortadorAdminDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const cortador = await prisma.cortador.findUnique({ where: { id }, select: { id: true, nombre: true } });
  if (!cortador) notFound();

  const [ordenes, cortadores] = await Promise.all([
    prisma.ordenProduccion.findMany({
      where: { cortadorId: id },
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true, sku: true, descripcion: true, marca: true, cantidad: true, estado: true, fichaCorteCargada: true, corteEstado: true, fechaCorte: true, costoCorte: true },
    }),
    prisma.cortador.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
  ]);

  const ops: OpAsignada[] = ordenes.map((o) => ({
    id: o.id, sku: o.sku, descripcion: o.descripcion, marca: o.marca, cantidad: o.cantidad,
    estado: o.estado, fichaCorteCargada: o.fichaCorteCargada, corteEstado: o.corteEstado,
    fechaCorte: o.fechaCorte ? o.fechaCorte.toISOString() : null, costoCorte: Number(o.costoCorte),
  }));

  const listos = ops.filter((o) => o.corteEstado === 'cargado' && !o.fichaCorteCargada);
  const asignados = ops.filter((o) => o.corteEstado !== 'cargado' && !o.fichaCorteCargada);
  const hechos = ops.filter((o) => o.fichaCorteCargada);

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <Link href="/produccion/cortadores" className="text-sm text-stone-500 hover:text-stone-800 transition">← Cortadores</Link>
      <PageHeader eyebrow="Producción / Cortadores" title={cortador.nombre} subtitle="Lo asignado a este cortador. Reasigná o quitá desde cada corte." />
      <CortadorAsignadosAdmin cortadorId={cortador.id} asignados={asignados} listos={listos} hechos={hechos} cortadores={cortadores} />
    </div>
  );
}
