import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { volverASeguro } from '@/lib/volverA';
import { CORRIDA_INCLUDE, resumenDe } from '@/lib/calculadora/corridaDb';
import { procesoPropuesto } from '@/lib/calculadora/corrida';
import { FichaAcciones } from '@/components/calculadora/FichaAcciones';

export const dynamic = 'force-dynamic';

const min = (n: number) => `${n.toString().replace('.', ',')} min`;

export default async function CorridaFicha({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ volverA?: string }>;
}) {
  const { id } = await params;
  const volver = volverASeguro((await searchParams).volverA, '/calculadora');

  const corrida = await prisma.corridaMuestra.findUnique({ where: { id }, include: CORRIDA_INCLUDE });
  if (!corrida) notFound();

  const r = resumenDe(corrida);
  const escandallos = await prisma.escandallo.findMany({
    select: { id: true, nombre: true, sku: true, marca: true },
    orderBy: { nombre: 'asc' },
  });

  const unidades = r.unidades.map((u) => u.unidad);
  const listoParaAplicar = r.unidadesMedidas > 0 && corrida.estado === 'terminada';

  return (
    <div className="p-8 max-w-5xl">
      <Link href={volver} className="text-sm text-stone-400 hover:text-stone-700 print:hidden">← Volver</Link>

      <PageHeader
        className="mt-3"
        eyebrow={corrida.modo === 'relevamiento' ? 'Relevamiento' : 'Corrida de muestra'}
        title={`${corrida.nombre} · ${corrida.talle}`}
        subtitle={`${corrida.marca} · ${corrida.tipoPrenda} · ${corrida.costurera} · ${r.unidadesMedidas} de ${corrida.unidadesObjetivo} prendas medidas`}
      />

      {/* ── Paso × prenda ─────────────────────────────────────────────── */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-400">
              <tr>
                <th className="text-left font-bold px-4 py-2.5">Paso</th>
                <th className="text-left font-bold px-4 py-2.5">Máquina</th>
                {unidades.map((u) => <th key={u} className="text-right font-bold px-3 py-2.5">p{u}</th>)}
                <th className="text-right font-bold px-4 py-2.5">Prom</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {r.porPaso.map((p) => (
                <tr key={p.pasoId}>
                  <td className="px-4 py-2.5 text-stone-800">
                    {p.nombre}
                    {p.desvioPct > 0 && <span className="ml-2 text-amber-600" title="Se hizo parte en otra máquina">⚠</span>}
                  </td>
                  <td className="px-4 py-2.5 text-stone-400 text-xs">{p.maquina}</td>
                  {unidades.map((u) => {
                    const v = p.porUnidad.find((x) => x.unidad === u);
                    return (
                      <td key={u} className={`px-3 py-2.5 text-right tabular-nums ${p.dispersionPct > 40 ? 'text-amber-700' : 'text-stone-600'}`}>
                        {v ? v.minutos.toString().replace('.', ',') : '—'}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-stone-900">
                    {p.promedio.toString().replace('.', ',')}
                  </td>
                </tr>
              ))}
              {r.porPaso.length === 0 && (
                <tr><td colSpan={3 + unidades.length} className="px-4 py-6 text-center text-stone-400 text-sm">Todavía no se midió ningún paso.</td></tr>
              )}
            </tbody>
            <tfoot className="bg-stone-50 text-sm">
              <tr>
                <td className="px-4 py-2.5 font-bold text-stone-700" colSpan={2}>Trabajo</td>
                {r.unidades.map((u) => (
                  <td key={u.unidad} className="px-3 py-2.5 text-right font-semibold tabular-nums">{u.trabajo.toString().replace('.', ',')}</td>
                ))}
                <td className="px-4 py-2.5 text-right font-bold tabular-nums">{r.promedio.toString().replace('.', ',')}</td>
              </tr>
              <tr className="text-stone-400">
                <td className="px-4 py-2 text-xs" colSpan={2}>Paradas (no entran al costo)</td>
                {r.unidades.map((u) => (
                  <td key={u.unidad} className="px-3 py-2 text-right text-xs tabular-nums">{u.paradas.toString().replace('.', ',')}</td>
                ))}
                <td className="px-4 py-2 text-right text-xs tabular-nums">{r.minutosParadas.toString().replace('.', ',')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Lo que audita el proceso ──────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Desvíos de máquina</p>
          {r.desvios.length === 0 && <p className="text-sm text-stone-400">Cada paso se hizo en su máquina.</p>}
          {r.desvios.map((d) => (
            <div key={d.pasoId} className={`rounded-xl px-4 py-3 mb-2 ${d.sistematico ? 'bg-amber-50 border border-amber-200' : 'bg-stone-50'}`}>
              <p className="text-sm font-semibold text-stone-800">{d.nombre}</p>
              <p className="text-xs text-stone-500 mt-0.5">definido: {d.maquinaDefinida}</p>
              <p className="text-xs text-stone-600 mt-1">
                real: {d.reparto.map((x) => `${x.maquina} ${x.pct}%`).join(' · ')}
              </p>
              {d.sistematico && (
                <p className="text-xs font-semibold text-amber-800 mt-2">
                  Pasó en {d.unidadesConDesvio} de {d.unidadesMedidas} prendas → ese paso son DOS pasos.
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">
            Paradas declaradas · {min(r.minutosParadas)} ({r.paradasPct}%)
          </p>
          {r.paradas.length === 0 && <p className="text-sm text-stone-400">No se declaró ninguna parada.</p>}
          <ul className="text-sm text-stone-600 space-y-1">
            {r.paradas.map((p) => (
              <li key={p.motivo} className="flex justify-between gap-4">
                <span>{p.motivo}</span>
                <span className="tabular-nums text-stone-400">{min(p.minutos)} · {p.veces}×</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-stone-400 mt-3 leading-relaxed">
            Las paradas se miden pero no entran al estándar: son tiempo del taller, y el taller
            ya está adentro del costo del minuto.
          </p>
        </div>
      </div>

      {/* ── Ribetes ───────────────────────────────────────────────────── */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">
          Ribete medido · talle {corrida.talle}
        </p>
        {corrida.ribetes.length === 0 && <p className="text-sm text-stone-400">La costurera todavía no cargó los centímetros.</p>}
        <ul className="text-sm text-stone-700 space-y-1">
          {corrida.ribetes.map((rb) => (
            <li key={rb.id} className="flex justify-between gap-4">
              <span>{rb.nombre}</span>
              <span className="tabular-nums text-stone-500">
                {rb.anchoCm.toString().replace('.', ',')} × {rb.largoCm.toString().replace('.', ',')} cm
              </span>
            </li>
          ))}
        </ul>
      </div>

      {!r.bajando && r.unidadesMedidas >= 2 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6">
          <p className="text-sm font-semibold text-amber-900">El tiempo no bajó de la primera prenda a la última.</p>
          <p className="text-xs text-amber-800 mt-1">
            En una muestra se espera que baje. Antes de aplicar este número al costo, mirá si hubo
            una parada sin marcar o si falta partir un paso.
          </p>
        </div>
      )}

      <FichaAcciones
        corridaId={corrida.id}
        modo={corrida.modo}
        estado={corrida.estado}
        tipoPrenda={corrida.tipoPrenda}
        talle={corrida.talle}
        escandalloId={corrida.escandalloId}
        aplicada={corrida.aplicadaAt != null}
        listoParaAplicar={listoParaAplicar}
        escandallos={escandallos}
        propuesta={procesoPropuesto(r.porPaso)}
        resumen={{ promedio: r.promedio, ultima: r.ultima, mejor: r.mejor, unidadesMedidas: r.unidadesMedidas }}
        tieneRibetes={corrida.ribetes.length > 0}
      />
    </div>
  );
}
