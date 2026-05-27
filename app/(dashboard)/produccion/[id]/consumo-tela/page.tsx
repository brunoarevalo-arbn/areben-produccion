import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { ConsumoTelaForm } from '@/components/produccion/ConsumoTelaForm';

export const dynamic = 'force-dynamic';

export default async function ConsumoTelaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const orden = await prisma.ordenProduccion.findUnique({
    where: { id },
    select: { id: true, sku: true, estado: true, cantidad: true, descripcion: true, marca: true, costoTela: true },
  });

  if (!orden) notFound();

  if (orden.estado !== 'CORTE') {
    return (
      <div className="p-8 max-w-4xl">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          El consumo de tela solo se registra cuando la OP esta en estado CORTE. Estado actual: {orden.estado}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Produccion / Consumo de tela</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1 font-mono">{orden.sku}</h1>
        <p className="text-stone-500 text-sm mt-1">
          {orden.descripcion || orden.marca} · {orden.cantidad} unidades
          {Number(orden.costoTela) > 0 && ` · Costo tela ya registrado: $${Number(orden.costoTela).toLocaleString('es-AR')}`}
        </p>
      </div>
      <ConsumoTelaForm ordenId={orden.id} sku={orden.sku} />
    </div>
  );
}
