import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { RegistrarCorteForm } from '@/components/produccion/RegistrarCorteForm';
import { CorteRevertir } from '@/components/produccion/CorteRevertir';

export const dynamic = 'force-dynamic';

const fmt = (n: unknown) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

export default async function CortePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const orden = await prisma.ordenProduccion.findUnique({
    where: { id },
    include: { cortesPorTalle: { orderBy: { talle: 'asc' } } },
  });

  if (!orden) notFound();

  if (orden.fichaCorteCargada) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="mb-8">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Produccion / Corte</span>
          <h1 className="text-2xl font-bold text-stone-900 mt-1 font-mono">{orden.sku}</h1>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-bold text-emerald-800 mb-3">Corte ya registrado</h3>
          <div className="space-y-2 text-sm">
            <p><span className="text-emerald-600">Total cortadas:</span> <strong>{orden.cantidad} unidades</strong></p>
            <p><span className="text-emerald-600">Costo tela:</span> <strong>${fmt(orden.costoTela)}</strong></p>
            <p><span className="text-emerald-600">Insumos sec.:</span> <strong>${fmt(orden.costoInsumosSecundarios)}</strong></p>
            <p><span className="text-emerald-600">Costo total:</span> <strong>${fmt(orden.costoTotal)}</strong></p>
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
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Produccion / Registrar corte</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1 font-mono">{orden.sku}</h1>
        <p className="text-stone-500 text-sm mt-1">
          {orden.descripcion || orden.marca} · Planificadas: {orden.cantidad} unidades
        </p>
      </div>
      <RegistrarCorteForm ordenId={orden.id} sku={orden.sku ?? ''} cantidadPlanificada={orden.cantidad} />
    </div>
  );
}
