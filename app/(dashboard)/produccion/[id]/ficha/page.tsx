import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PrintButton } from '@/components/costos/PrintButton';
import { consumoNetoPorRollo } from '@/lib/produccion/consumo';
import { volverASeguro } from '@/lib/volverA';

export const dynamic = 'force-dynamic';

const fmt = (n: unknown) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

export default async function FichaCortePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ volverA?: string }> }) {
  const { id } = await params;
  const volver = volverASeguro((await searchParams).volverA, `/produccion/${id}`);
  const qs = `?volverA=${encodeURIComponent(volver)}`;
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

  // Constancia: si al cortar faltaba tela según el rinde promedio (se cortó igual).
  const faltantes = ((orden.fichaCorteData as { faltantes?: { nombre: string; faltante: number }[] } | null)?.faltantes ?? [])
    .filter((f) => f && f.faltante > 0.001);

  // Consumo NETO por rollo (una ficha editada tiene CONSUMO + REVERSION + CONSUMO…).
  const { kg: kgTotal, metros: metrosTotal, porRollo } = consumoNetoPorRollo(
    orden.movimientosInsumo.map((m) => ({ rolloId: m.rolloId, cantidad: Number(m.cantidad), unidadDefault: m.rollo?.insumo.unidadDefault ?? null, rinde: m.rollo?.insumo.rinde ? Number(m.rollo.insumo.rinde) : null })),
  );
  // Info de display por rollo (código, tela, color) — primer movimiento de cada rollo.
  const rolloInfo = new Map<string, { codigo: string; nombre: string; color: string | null; unidad: string }>();
  for (const m of orden.movimientosInsumo) {
    if (m.rolloId && m.rollo && !rolloInfo.has(m.rolloId)) {
      rolloInfo.set(m.rolloId, { codigo: m.rollo.codigo, nombre: m.rollo.insumo.nombre, color: m.rollo.color?.nombre ?? null, unidad: m.rollo.insumo.unidadDefault });
    }
  }
  const filasTela = [...porRollo.entries()].map(([rolloId, v]) => ({ rolloId, consumo: v.consumo, ...rolloInfo.get(rolloId)! }));
  const metrosPorU = totalCortado > 0 ? metrosTotal / totalCortado : 0;
  const kgPorU = totalCortado > 0 ? kgTotal / totalCortado : 0;
  const fecha = new Date(orden.fechaCorte ?? orden.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

  if (!orden.fichaCorteCargada) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center">
        <p className="text-stone-500 mb-4">Esta orden todavía no tiene ficha de corte cargada.</p>
        <Link href={volver} className="block text-sm text-stone-500 hover:text-stone-800 transition mb-4">← Volver</Link>
        <Link href={`/produccion/${orden.id}/corte${qs}`} className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">Cargar ficha de corte</Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-baseline gap-4">
          <Link href={volver} className="text-sm text-stone-500 hover:text-stone-800 transition">← Volver</Link>
          <h1 className="text-lg font-bold text-stone-800">Ficha de corte</h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/produccion/${orden.id}/corte${qs}`} className="px-4 py-2 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition">Editar</Link>
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

        {/* Constancia de rinde ajustado (faltaba tela según rinde promedio) */}
        {faltantes.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <strong>Cortado con rinde ajustado.</strong> Según el rinde promedio faltaba tela: {faltantes.map((f) => `${f.nombre} ${fmt(f.faltante)} m`).join(' · ')}. La tela rindió más de lo estimado.
          </div>
        )}

        {/* Tela consumida (neto por rollo) */}
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-400 font-bold mb-2">Tela consumida</p>
          {filasTela.length === 0 ? (
            <p className="text-sm text-stone-400">Sin consumos registrados.</p>
          ) : (
            <table className="w-full text-sm border border-stone-200">
              <thead><tr className="bg-stone-50 text-xs uppercase tracking-widest text-stone-500">
                <th className="text-left py-1.5 px-3 border-b border-stone-200">Rollo</th>
                <th className="text-left py-1.5 px-3 border-b border-stone-200">Tela · Color</th>
                <th className="text-right py-1.5 px-3 border-b border-stone-200">Consumo</th>
              </tr></thead>
              <tbody>
                {filasTela.map((f) => (
                  <tr key={f.rolloId} className="border-b border-stone-100">
                    <td className="py-1.5 px-3 font-mono text-xs">{f.codigo}</td>
                    <td className="py-1.5 px-3">{f.nombre}{f.color ? ` · ${f.color}` : ''}</td>
                    <td className="py-1.5 px-3 text-right tabular-nums">{fmt(f.consumo)} {f.unidad}</td>
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
