import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PrintButton } from '@/components/costos/PrintButton';
import { resumenConsumoTela } from '@/lib/produccion/consumo';

export const dynamic = 'force-dynamic';

const fmt = (n: unknown) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

export default async function FichaCortePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orden = await prisma.ordenProduccion.findUnique({
    where: { id },
    include: {
      cortesPorTalle: { orderBy: { talle: 'asc' } },
      avios: { include: { etiqueta: { select: { nombre: true, unidad: true } } } },
      movimientosInsumo: {
        where: { rolloId: { not: null } },
        include: { rollo: { select: { codigo: true, insumo: { select: { nombre: true, unidadDefault: true, rinde: true } }, color: { select: { nombre: true } } } } },
        orderBy: { fecha: 'asc' },
      },
    },
  });
  if (!orden) notFound();

  const totalCortado = orden.cortesPorTalle.reduce((s, c) => s + c.cantidad, 0);

  // Consumo de tela (kg y metros) desde los movimientos de rollo. No mostramos costos:
  // van en el resumen de costos, no en la ficha de corte.
  const { kg: kgTotal, metros: metrosTotal } = resumenConsumoTela(
    orden.movimientosInsumo.map((m) => ({ cantidad: Number(m.cantidad), unidadDefault: m.rollo?.insumo.unidadDefault ?? null, rinde: m.rollo?.insumo.rinde ? Number(m.rollo.insumo.rinde) : null })),
  );
  const metrosPorU = totalCortado > 0 ? metrosTotal / totalCortado : 0;
  const kgPorU = totalCortado > 0 ? kgTotal / totalCortado : 0;
  const fecha = new Date(orden.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (!orden.fichaCorteCargada) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center">
        <p className="text-stone-500 mb-4">Esta orden todavía no tiene ficha de corte cargada.</p>
        <Link href={`/produccion/${orden.id}/corte`} className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">Cargar ficha de corte</Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h1 className="text-lg font-bold text-stone-800">Ficha de corte</h1>
        <div className="flex gap-2">
          <Link href={`/produccion/${orden.id}/corte`} className="px-4 py-2 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition">Editar</Link>
          <PrintButton />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-8 print:border-0 print:p-0 space-y-6">
        {/* Encabezado */}
        <div className="flex items-start justify-between border-b border-stone-200 pb-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-400 font-bold">Areben · Ficha de corte</p>
            <h2 className="text-xl font-bold font-mono text-stone-900 mt-1">{orden.sku ?? 'S/SKU'}</h2>
            <p className="text-sm text-stone-500 mt-0.5">{orden.descripcion || orden.marca} · {orden.marca}</p>
          </div>
          <div className="text-right text-sm text-stone-500">
            <p>Fecha: {fecha}</p>
            <p>Cantidad: <strong className="text-stone-800">{orden.cantidad} u</strong></p>
            {orden.cortador && <p>Cortador: <strong className="text-stone-800">{orden.cortador}</strong></p>}
          </div>
        </div>

        {/* Talles */}
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-400 font-bold mb-2">Talles cortados</p>
          <div className="flex flex-wrap gap-2">
            {orden.cortesPorTalle.map((c) => (
              <div key={c.id} className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 text-sm">
                <span className="text-stone-500 mr-1.5">{c.talle}</span><strong className="text-stone-900 tabular-nums">{c.cantidad}</strong>
              </div>
            ))}
            <div className="bg-stone-900 text-white rounded-lg px-3 py-1.5 text-sm ml-auto"><span className="opacity-70 mr-1.5">Total</span><strong className="tabular-nums">{totalCortado}</strong></div>
          </div>
        </div>

        {/* Tela consumida */}
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-400 font-bold mb-2">Tela consumida</p>
          {orden.movimientosInsumo.length === 0 ? (
            <p className="text-sm text-stone-400">Sin consumos registrados.</p>
          ) : (
            <table className="w-full text-sm border border-stone-200">
              <thead><tr className="bg-stone-50 text-xs uppercase tracking-widest text-stone-500">
                <th className="text-left py-1.5 px-3 border-b border-stone-200">Rollo</th>
                <th className="text-left py-1.5 px-3 border-b border-stone-200">Tela · Color</th>
                <th className="text-right py-1.5 px-3 border-b border-stone-200">Consumo</th>
              </tr></thead>
              <tbody>
                {orden.movimientosInsumo.map((m) => (
                  <tr key={m.id} className="border-b border-stone-100">
                    <td className="py-1.5 px-3 font-mono text-xs">{m.rollo?.codigo}</td>
                    <td className="py-1.5 px-3">{m.rollo?.insumo.nombre}{m.rollo?.color ? ` · ${m.rollo.color.nombre}` : ''}</td>
                    <td className="py-1.5 px-3 text-right tabular-nums">{fmt(Math.abs(Number(m.cantidad)))} {m.rollo?.insumo.unidadDefault}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {/* Resumen de consumo */}
          {orden.movimientosInsumo.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Consumo total</p>
                <p className="text-stone-800 font-semibold tabular-nums">
                  {kgTotal > 0 && <>{fmt(kgTotal)} kg</>}
                  {kgTotal > 0 && metrosTotal > 0 && <span className="text-stone-400"> · </span>}
                  {metrosTotal > 0 && <>{fmt(metrosTotal)} m</>}
                  {kgTotal === 0 && metrosTotal === 0 && '--'}
                </p>
              </div>
              <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Por unidad ({totalCortado} u)</p>
                <p className="text-stone-800 font-semibold tabular-nums">
                  {metrosPorU > 0 ? <>{fmt(metrosPorU)} m/u</> : '--'}
                  {kgPorU > 0 && <span className="text-stone-500 font-normal"> · {fmt(kgPorU)} kg/u</span>}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Avíos */}
        {orden.avios.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-400 font-bold mb-2">Avíos</p>
            <div className="flex flex-wrap gap-2">
              {orden.avios.map((a) => (
                <div key={a.id} className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 text-sm">
                  {a.etiqueta.nombre} <span className="text-stone-400">×{a.cantidad}/prenda</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
