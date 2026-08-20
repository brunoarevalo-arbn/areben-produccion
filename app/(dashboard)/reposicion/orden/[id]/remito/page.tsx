import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/costos/PrintButton';
import { nombreItemOrden } from '@/lib/produccion/ordenEstampa';

export const dynamic = 'force-dynamic';

export default async function RemitoEstampaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orden = await prisma.ordenEstampa.findUnique({
    where: { id },
    include: { items: { orderBy: [{ skuLiso: 'asc' }, { gnNombre: 'asc' }, { talle: 'asc' }], include: { estampa: { select: { codigoInterno: true, nombreComercial: true } } } } },
  });
  if (!orden) notFound();

  // Solo lo realmente estampado (confirmado) — es lo que se carga en Gestión Nube.
  const items = orden.items.filter((i) => i.confirmado > 0);
  const porLiso = new Map<string, typeof items>();
  for (const it of items) { if (!porLiso.has(it.skuLiso)) porLiso.set(it.skuLiso, []); porLiso.get(it.skuLiso)!.push(it); }
  const total = items.reduce((s, i) => s + i.confirmado, 0);
  const totalPed = orden.items.reduce((s, i) => s + i.cantidad, 0);
  const pendientes = totalPed - total;
  const esParcial = orden.estado === 'parcial';
  const fecha = new Date(orden.creadoAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const esProd = orden.tipo === 'produccion';
  const titulo = (esProd ? 'Remito de producción' : 'Remito de estampa') + (esParcial ? ' (parcial)' : '');

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h1 className="text-lg font-bold text-stone-800">{titulo}</h1>
        <PrintButton />
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-8 print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-stone-200 pb-4 mb-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-400 font-bold">Areben · {titulo}</p>
            <h2 className="text-xl font-bold text-stone-900 mt-1">Para cargar en Gestión Nube</h2>
          </div>
          <div className="text-right text-sm text-stone-500">
            <p>Fecha: {fecha}</p>
            <p>Orden: {orden.id.slice(0, 8)}</p>
            <p>Total: <strong className="text-stone-800">{total} prendas</strong></p>
            {esParcial && pendientes > 0 && <p className="text-amber-600">Pendientes: {pendientes}</p>}
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-stone-400">La orden no tiene cantidades estampadas (confirmadas).</p>
        ) : [...porLiso.entries()].map(([liso, its]) => (
          <div key={liso} className="mb-5">
            <p className="font-mono text-xs text-stone-500 mb-1">{esProd ? 'SKU a producir' : 'Liso base'}: {liso}</p>
            <table className="w-full text-sm border border-stone-200">
              <thead><tr className="bg-stone-50 text-xs uppercase tracking-widest text-stone-500">
                <th className="text-left py-1.5 px-3 border-b border-stone-200">Producto</th>
                <th className="text-left py-1.5 px-3 border-b border-stone-200">Talle</th>
                <th className="text-right py-1.5 px-3 border-b border-stone-200">Cantidad</th>
              </tr></thead>
              <tbody>
                {its.map((it) => (
                  <tr key={it.id} className="border-b border-stone-100">
                    <td className="py-1.5 px-3">{nombreItemOrden(it)}</td>
                    <td className="py-1.5 px-3 font-semibold">{it.talle}</td>
                    <td className="py-1.5 px-3 text-right tabular-nums font-bold">{it.confirmado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {orden.notas && <p className="text-xs text-stone-500 mt-4">Notas: {orden.notas}</p>}
      </div>
    </div>
  );
}
