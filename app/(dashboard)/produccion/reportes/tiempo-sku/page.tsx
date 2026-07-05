import { prisma } from '@/lib/prisma';
import { minutosAHorasMin } from '@/lib/utils/calculos';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente', CORTE: 'Corte', COSTURA: 'Costura', TERMINADO_SIN_ESTAMPA: 'Listo',
  ESTAMPA: 'Estampa', CONTROL_CALIDAD: 'Control',
};
const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });

export default async function TiempoSkuPage() {
  // OPs en producción (no cerradas) con SKU → unidades y estados por SKU.
  const ops = await prisma.ordenProduccion.findMany({
    where: { sku: { not: null }, estado: { not: 'CERRADA' } },
    select: { sku: true, marca: true, descripcion: true, cantidad: true, estado: true },
    orderBy: { createdAt: 'desc' },
  });

  const bySku = new Map<string, { sku: string; marca: string; descripcion: string | null; unidades: number; estados: Set<string> }>();
  for (const op of ops) {
    const sku = op.sku!;
    const e = bySku.get(sku) ?? { sku, marca: op.marca, descripcion: op.descripcion, unidades: 0, estados: new Set<string>() };
    e.unidades += op.cantidad;
    e.estados.add(op.estado);
    bySku.set(sku, e);
  }

  const skus = [...bySku.keys()];
  const tiempos = skus.length
    ? await prisma.tiemposProduccion.findMany({ where: { sku: { in: skus } } })
    : [];

  const tiempoBySku = new Map<string, { total: number; registros: number; porActividad: Map<string, number> }>();
  for (const t of tiempos) {
    if (!t.sku) continue;
    const e = tiempoBySku.get(t.sku) ?? { total: 0, registros: 0, porActividad: new Map() };
    e.total += t.minutosNetos;
    e.registros += 1;
    e.porActividad.set(t.actividad, (e.porActividad.get(t.actividad) ?? 0) + t.minutosNetos);
    tiempoBySku.set(t.sku, e);
  }

  const filas = [...bySku.values()]
    .map((g) => {
      const t = tiempoBySku.get(g.sku);
      const totalMin = t?.total ?? 0;
      const minU = g.unidades > 0 ? totalMin / g.unidades : 0;
      const actividades = [...(t?.porActividad ?? new Map()).entries()]
        .map(([actividad, min]) => ({ actividad, min: min as number, minU: g.unidades > 0 ? (min as number) / g.unidades : 0 }))
        .sort((a, b) => b.min - a.min);
      return { ...g, totalMin, minU, registros: t?.registros ?? 0, actividades };
    })
    .sort((a, b) => b.minU - a.minU);

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        eyebrow="Producción"
        title="Tiempo por SKU (en producción)"
        subtitle="Minutos por unidad de lo que se está produciendo, en vivo — sin esperar a cerrar la orden ni pasar por costos."
        actions={<Link href="/produccion/reportes/sku" className="border border-stone-200 hover:border-stone-400 text-stone-600 text-sm font-semibold px-4 py-2.5 rounded-xl transition">Cerradas →</Link>}
      />

      {filas.length === 0 ? (
        <EmptyState message="No hay órdenes en producción con SKU." />
      ) : (
        <div className="space-y-3">
          {filas.map((f) => (
            <Card key={f.sku} padding="none" className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-sm bg-stone-100 px-2 py-1 rounded-lg text-stone-800">{f.sku}</span>
                  <span className="text-xs text-stone-400">{f.descripcion || f.marca}</span>
                  {[...f.estados].map((e) => <span key={e} className="text-xs text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">{ESTADO_LABEL[e] ?? e}</span>)}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-stone-900 tabular-nums">{f.minU > 0 ? `${fmt(f.minU)} min/u` : '—'}</p>
                  <p className="text-xs text-stone-400">{f.unidades} u · {minutosAHorasMin(Math.round(f.totalMin))} total</p>
                </div>
              </div>
              {f.registros === 0 ? (
                <p className="text-xs text-stone-400">Sin tiempos registrados todavía.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {f.actividades.map((a) => (
                    <div key={a.actividad} className="bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1 text-xs">
                      <span className="text-stone-500">{a.actividad}:</span> <strong className="text-stone-800 tabular-nums">{fmt(a.minU)} min/u</strong>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
