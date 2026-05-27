import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { minutosAHorasMin } from '@/lib/utils/calculos';

export const dynamic = 'force-dynamic';

interface Breakdown { minutos: number; registros: number }
interface BreakdownCosturera extends Breakdown { prendas: number }

function fechaCorta(d: Date | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default async function ReporteSkuPage() {
  const ordenes = await prisma.ordenProduccion.findMany({
    where: { estado: 'CERRADA' },
    orderBy: { terminadoAt: 'desc' },
  });

  const skus = [...new Set(ordenes.map((o) => o.sku))];
  const tiempos = await prisma.tiemposProduccion.findMany({
    where: { sku: { in: skus } },
  });

  const tiemposBySku = new Map<string, typeof tiempos>();
  for (const t of tiempos) {
    if (!t.sku) continue;
    const arr = tiemposBySku.get(t.sku) ?? [];
    arr.push(t);
    tiemposBySku.set(t.sku, arr);
  }

  const filas = ordenes.map((orden) => {
    const ts = tiemposBySku.get(orden.sku) ?? [];
    const totalMinutos = ts.reduce((s, t) => s + t.minutosNetos, 0);

    const porMaquina:   Record<string, Breakdown>          = {};
    const porCosturera: Record<string, BreakdownCosturera> = {};
    const porActividad: Record<string, Breakdown>          = {};

    for (const t of ts) {
      if (t.maquina) {
        porMaquina[t.maquina] ??= { minutos: 0, registros: 0 };
        porMaquina[t.maquina].minutos   += t.minutosNetos;
        porMaquina[t.maquina].registros += 1;
      }
      porCosturera[t.usuario] ??= { minutos: 0, registros: 0, prendas: 0 };
      porCosturera[t.usuario].minutos   += t.minutosNetos;
      porCosturera[t.usuario].registros += 1;
      porCosturera[t.usuario].prendas   += t.cantidad;

      porActividad[t.actividad] ??= { minutos: 0, registros: 0 };
      porActividad[t.actividad].minutos   += t.minutosNetos;
      porActividad[t.actividad].registros += 1;
    }

    return {
      orden,
      totalMinutos,
      minutosPorPrenda: orden.cantidad > 0 ? totalMinutos / orden.cantidad : 0,
      cantRegistros: ts.length,
      porMaquina,
      porCosturera,
      porActividad,
    };
  });

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Producción</span>
          <h1 className="text-2xl font-bold text-stone-900 mt-1">Costos por SKU</h1>
          <p className="text-stone-500 text-sm mt-1">
            Cortes terminados con minutos totales y desglose por máquina, costurera y actividad.
          </p>
        </div>
        <Link
          href="/produccion/reportes"
          className="text-sm border border-stone-200 hover:border-stone-400 text-stone-600 px-4 py-2.5 rounded-xl transition"
        >
          ← Reportes diarios
        </Link>
      </div>

      {filas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center">
          <div className="text-4xl mb-3">📦</div>
          <p className="text-stone-500 text-sm">Sin cortes terminados todavía.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filas.map((f) => (
            <details
              key={f.orden.id}
              className="bg-white rounded-2xl border border-stone-200 overflow-hidden group"
            >
              <summary className="px-5 py-4 cursor-pointer hover:bg-stone-50 list-none flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm bg-stone-100 px-2 py-1 rounded-lg text-stone-700">
                      {f.orden.sku}
                    </span>
                    <span className="text-xs text-stone-400">{f.orden.marca}</span>
                    {f.orden.descripcion && (
                      <span className="text-sm text-stone-600 truncate">— {f.orden.descripcion}</span>
                    )}
                  </div>
                  <p className="text-xs text-stone-400 mt-1">
                    Terminado: {fechaCorta(f.orden.terminadoAt)} · {f.cantRegistros} {f.cantRegistros === 1 ? 'registro' : 'registros'}
                  </p>
                </div>

                <div className="flex items-center gap-5 shrink-0 text-right">
                  <div>
                    <p className="text-lg font-bold text-stone-800 tabular-nums">{f.orden.cantidad}</p>
                    <p className="text-[10px] uppercase tracking-widest text-stone-400">Prendas</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-amber-700 tabular-nums">{minutosAHorasMin(f.totalMinutos)}</p>
                    <p className="text-[10px] uppercase tracking-widest text-stone-400">Total</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-700 tabular-nums">
                      {f.minutosPorPrenda > 0 ? `${f.minutosPorPrenda.toFixed(1)}'` : '—'}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-stone-400">Min/prenda</p>
                  </div>
                  <span className="text-stone-400 text-xl group-open:rotate-180 transition-transform">⌄</span>
                </div>
              </summary>

              <div className="border-t border-stone-100 bg-stone-50/50 px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-5">
                <BreakdownTable titulo="Por máquina" data={f.porMaquina} />
                <BreakdownTable titulo="Por costurera" data={f.porCosturera} mostrarPrendas />
                <BreakdownTable titulo="Por actividad" data={f.porActividad} />
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function BreakdownTable({
  titulo,
  data,
  mostrarPrendas = false,
}: {
  titulo: string;
  data: Record<string, Breakdown | BreakdownCosturera>;
  mostrarPrendas?: boolean;
}) {
  const filas = Object.entries(data).sort((a, b) => b[1].minutos - a[1].minutos);

  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">{titulo}</h3>
      {filas.length === 0 ? (
        <p className="text-xs text-stone-400 italic">Sin datos</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {filas.map(([nombre, stats]) => (
              <tr key={nombre} className="border-b border-stone-200/60 last:border-b-0">
                <td className="py-1.5 text-stone-700 font-medium truncate pr-2">{nombre}</td>
                {mostrarPrendas && 'prendas' in stats && (
                  <td className="py-1.5 text-right text-xs text-stone-500 tabular-nums whitespace-nowrap">
                    {stats.prendas} pzas
                  </td>
                )}
                <td className="py-1.5 text-right font-semibold text-amber-700 tabular-nums whitespace-nowrap pl-2">
                  {minutosAHorasMin(stats.minutos)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
