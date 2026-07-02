import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PrintButton } from '@/components/costos/PrintButton';
import { CopiarResumen } from '@/components/costos/CopiarResumen';
import { parseDatos, telaCosto, itemCosto, calcular } from '@/lib/costos/escandallo';

export const dynamic = 'force-dynamic';

function fmt$(n: number) { return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtC(n: number) { return `$${Math.round(n).toLocaleString('es-AR')}`; } // compacto para el mensaje

export default async function EscandalloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [escandallo, gastos, costureras] = await Promise.all([
    prisma.escandallo.findUnique({ where: { id } }),
    prisma.gastoFijoTaller.findMany({ where: { activo: true } }),
    prisma.costoCosturera.findMany(),
  ]);

  if (!escandallo) notFound();

  const totalGastos   = gastos.reduce((s, g) => s + g.monto, 0);
  const totalCosturas = costureras.reduce((s, c) => s + c.sueldoBruto + c.cargasSociales, 0);
  const totalHoras    = costureras.reduce((s, c) => s + c.horasMes, 0);
  const valorHora     = totalHoras > 0 ? (totalGastos + totalCosturas) / totalHoras : 0;
  const costoMinuto   = valorHora / 60;

  const datos = parseDatos(escandallo.datos);

  const telasCosts = datos.telas.map(t => {
    const { pMetro, costo } = telaCosto(t);
    return { ...t, pMetro, costo };
  });

  // Fuente única de cálculo: la misma calcular() que usan el editor y la lista,
  // con los márgenes congelados en el escandallo. (Antes el PDF lo recalculaba
  // a mano y con otra fuente de márgenes → divergía de la lista.)
  const { costoTelas, costoServicios, costoMO, costoVarios, costoAvios, costoEmbolsado, costoBase, conDesarrollo, costoTotal } =
    calcular(datos, costoMinuto, { margenDesarrollo: datos.margenDesarrollo, margenFallas: datos.margenFallas });

  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  // Texto para copiar y mandar por WhatsApp a administración (costo + descripción).
  const resumenTexto = [
    `*${escandallo.sku || escandallo.nombre}*${escandallo.sku ? ` — ${escandallo.nombre}` : ''}`,
    escandallo.marca ? `Marca: ${escandallo.marca}` : null,
    escandallo.notas ? `\n${escandallo.notas}` : null,
    ``,
    `💵 Costo unitario: ${fmtC(costoTotal)}`,
    `_Telas ${fmtC(costoTelas)} · Servicios ${fmtC(costoServicios)} · MO ${fmtC(costoMO)}${costoVarios > 0 ? ` · Varios ${fmtC(costoVarios)}` : ''} · Avíos ${fmtC(costoAvios)}_`,
  ].filter((l) => l !== null).join('\n');

  return (
    <div>
      {/* Barra de acción */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-stone-200 px-6 py-3 flex items-center gap-4">
        <Link href="/costos" className="text-sm text-stone-500 hover:text-stone-800 transition">← Volver</Link>
        <div className="flex-1" />
        <CopiarResumen texto={resumenTexto} />
        <PrintButton />
      </div>

      {/* Documento */}
      <div className="max-w-2xl mx-auto px-8 py-10 print:px-0 print:py-0 print:max-w-full">

        {/* Encabezado */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-stone-900">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Ficha de Costo — Escandallo</p>
            <h1 className="text-2xl font-bold text-stone-900">{escandallo.nombre}</h1>
            <div className="flex items-center gap-3 mt-2">
              {escandallo.sku        && <span className="font-mono text-sm bg-stone-100 px-2 py-0.5 rounded text-stone-700">{escandallo.sku}</span>}
              {escandallo.marca      && <span className="text-sm text-stone-500">{escandallo.marca}</span>}
              {escandallo.tipoPrenda && <span className="text-sm text-stone-400 italic">{escandallo.tipoPrenda}</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-stone-400">Areben</p>
            <p className="text-xs text-stone-400">{fecha}</p>
          </div>
        </div>

        {/* Telas */}
        {datos.costoTelaFicha != null ? (
        <div className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Telas</h2>
          <div className="flex justify-between text-sm border-b border-stone-100 py-2.5">
            <span className="text-stone-600">Tela (de la ficha de corte, incluye insumos del corte)</span>
            <span className="font-bold tabular-nums text-stone-900">{fmt$(costoTelas)}</span>
          </div>
        </div>
        ) : (
        <div className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Telas</h2>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left py-2 font-semibold text-stone-600 pr-4">Tela</th>
                <th className="text-right py-2 font-semibold text-stone-600 w-24">$/kg neto</th>
                <th className="text-right py-2 font-semibold text-stone-600 w-16">Flete</th>
                <th className="text-right py-2 font-semibold text-stone-600 w-20">m/kg</th>
                <th className="text-right py-2 font-semibold text-stone-600 w-24">$/metro</th>
                <th className="text-right py-2 font-semibold text-stone-600 w-20">Cons.</th>
                <th className="text-right py-2 font-semibold text-stone-600 w-24">Costo</th>
              </tr>
            </thead>
            <tbody>
              {telasCosts.map((t, i) => (
                <tr key={i} className="border-b border-stone-100">
                  <td className="py-2.5 pr-4 text-stone-800">{t.nombre || `Tela ${i + 1}`}</td>
                  <td className="py-2.5 text-right tabular-nums text-stone-700">{fmt$(t.precioKgNeto)}</td>
                  <td className="py-2.5 text-right tabular-nums text-stone-500">{t.fletePercent}%</td>
                  <td className="py-2.5 text-right tabular-nums text-stone-700">{t.rindeMetrosKg}</td>
                  <td className="py-2.5 text-right tabular-nums text-stone-700">{fmt$(t.pMetro)}</td>
                  <td className="py-2.5 text-right tabular-nums text-stone-700">{t.consumoMetros}m</td>
                  <td className="py-2.5 text-right font-semibold tabular-nums text-stone-900">{fmt$(t.costo)}</td>
                </tr>
              ))}
              {telasCosts.length === 0 && (
                <tr><td colSpan={7} className="py-4 text-center text-stone-400 italic text-sm">Sin telas cargadas</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-300">
                <td colSpan={6} className="pt-3 font-bold text-stone-700">Total telas</td>
                <td className="pt-3 text-right font-bold tabular-nums text-stone-900">{fmt$(costoTelas)}</td>
              </tr>
            </tfoot>
          </table></div>
        </div>
        )}

        {/* Servicios fijos */}
        <div className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Servicios fijos</h2>
          <div className="space-y-1.5 text-sm">
            {[
              { label: 'Corte',    val: datos.costoCorte },
              { label: 'Tizada',   val: datos.costoTizada },
              { label: 'Lavadero', val: datos.costoLavadero },
            ].map(r => (
              <div key={r.label} className="flex justify-between">
                <span className="text-stone-600">{r.label}</span>
                <span className="tabular-nums font-semibold">{fmt$(r.val)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-stone-200 pt-1.5 font-bold">
              <span>Total servicios</span>
              <span className="tabular-nums">{fmt$(costoServicios)}</span>
            </div>
          </div>
        </div>

        {/* MO Confección */}
        <div className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">MO Confección</h2>
          <div className="flex justify-between text-sm">
            <span className="text-stone-600">{datos.tiempoConfeccion} min × {fmt$(costoMinuto)}/min</span>
            <span className="font-bold tabular-nums">{fmt$(costoMO)}</span>
          </div>
        </div>

        {/* Varios */}
        {datos.varios.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Varios</h2>
            <div className="space-y-1.5 text-sm">
              {datos.varios.map((v, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-stone-600">{v.nombre}{v.cantidad > 1 ? ` (${v.cantidad} × ${fmt$(v.costoUnitario)})` : ''}</span>
                  <span className="tabular-nums font-semibold">{fmt$(itemCosto(v))}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-stone-200 pt-1.5 font-bold">
                <span>Total varios</span>
                <span className="tabular-nums">{fmt$(costoVarios)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Terminación y Avíos */}
        <div className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Terminación y Avíos</h2>
          <div className="space-y-1.5 text-sm">
            {datos.avios.etiquetaPrincipal > 0 && (
              <div className="flex justify-between">
                <span className="text-stone-600">Etiqueta principal</span>
                <span className="tabular-nums font-semibold">{fmt$(datos.avios.etiquetaPrincipal)}</span>
              </div>
            )}
            {datos.avios.etiquetaComposicion > 0 && (
              <div className="flex justify-between">
                <span className="text-stone-600">Etiqueta composición</span>
                <span className="tabular-nums font-semibold">{fmt$(datos.avios.etiquetaComposicion)}</span>
              </div>
            )}
            {datos.avios.bolsaPolipropileno > 0 && (
              <div className="flex justify-between">
                <span className="text-stone-600">Bolsa polipropileno</span>
                <span className="tabular-nums font-semibold">{fmt$(datos.avios.bolsaPolipropileno)}</span>
              </div>
            )}
            {datos.avios.tiempoEmbolsado > 0 && (
              <div className="flex justify-between">
                <span className="text-stone-600">Embolsado ({datos.avios.tiempoEmbolsado} min)</span>
                <span className="tabular-nums font-semibold">{fmt$(costoEmbolsado)}</span>
              </div>
            )}
            {datos.avios.extras.map((e, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-stone-600">{e.nombre}{e.cantidad > 1 ? ` (${e.cantidad} × ${fmt$(e.costoUnitario)})` : ''}</span>
                <span className="tabular-nums font-semibold">{fmt$(itemCosto(e))}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-stone-200 pt-1.5 font-bold">
              <span>Total avíos</span>
              <span className="tabular-nums">{fmt$(costoAvios)}</span>
            </div>
          </div>
        </div>

        {/* Resumen de costos */}
        <div className="mb-8 border-t-2 border-stone-900 pt-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-4">Resumen de costos</h2>
          <div className="space-y-2 text-sm">
            {[
              { label: 'Telas',                                  val: costoTelas },
              { label: 'Servicios (corte + tizada + lavadero)', val: costoServicios },
              { label: 'MO Confección',                          val: costoMO },
              ...(costoVarios > 0  ? [{ label: 'Varios',               val: costoVarios }]  : []),
              { label: 'Terminación y avíos',                    val: costoAvios },
            ].map(r => (
              <div key={r.label} className="flex justify-between">
                <span className="text-stone-600">{r.label}</span>
                <span className="font-semibold tabular-nums">{fmt$(r.val)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-stone-200 pt-2 font-bold">
              <span>Costo base</span>
              <span className="tabular-nums">{fmt$(costoBase)}</span>
            </div>
            <div className="flex justify-between text-stone-400 text-xs">
              <span>+ Margen desarrollo ({datos.margenDesarrollo}%)</span>
              <span className="tabular-nums">+{fmt$(costoBase * datos.margenDesarrollo / 100)}</span>
            </div>
            <div className="flex justify-between text-stone-400 text-xs">
              <span>+ Margen fallas ({datos.margenFallas}%)</span>
              <span className="tabular-nums">+{fmt$(conDesarrollo * datos.margenFallas / 100)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 bg-stone-900 text-white rounded-xl px-4 py-3 mt-3">
              <div>
                <p className="text-xs text-stone-400 mb-0.5">Costo total unitario</p>
                <p className="text-2xl font-bold tabular-nums">{fmt$(costoTotal)}</p>
              </div>
            </div>
          </div>
        </div>

        {escandallo.notas && (
          <div className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Descripción</h2>
            <p className="text-sm text-stone-600 whitespace-pre-line">{escandallo.notas}</p>
          </div>
        )}

        <p className="text-xs text-stone-300 text-center mt-10">Generado por Areben · {fecha}</p>
      </div>

      <style>{`
        @media print {
          @page { margin: 1.5cm; }
          html, body { background: #fff !important; }
          /* Respetar colores (caja de costo, totales) al imprimir */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
