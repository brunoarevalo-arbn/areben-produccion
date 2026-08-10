import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PrintButton } from '@/components/costos/PrintButton';
import { parseDatos, telaCosto, itemCosto, calcular } from '@/lib/costos/escandallo';
import { fichaDetalleSku, type FichaTelaFila } from '@/lib/produccion/fichaConsumo';

export const dynamic = 'force-dynamic';

function fmt$(n: number) { return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

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
  // Desglose de la ficha de corte (telas por rollo + avíos), si el costeo viene de ficha.
  const desdeFicha = datos.costoTelaFicha != null || datos.costoAviosFicha != null;
  const ficha = desdeFicha ? await fichaDetalleSku(escandallo.sku) : null;
  const fmtM = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const fmtKg = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 3 });
  // Metros por prenda: 3 decimales, que en tiras y ribetes el consumo unitario es chico.
  const fmtMU = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 3 });

  // Los rollos se agrupan por artículo para poder leer cuánta tela de CADA uno lleva la
  // prenda (una remera ≈ 1 m): con varios rollos del mismo artículo, el dato útil es el
  // subtotal, no cada rollo por separado. `telas` ya viene ordenado por artículo.
  const uds = ficha && ficha.orden.cantidad > 0 ? ficha.orden.cantidad : 1;
  const gruposTela: { articulo: string; filas: FichaTelaFila[]; metros: number; kg: number; costo: number }[] = [];
  for (const t of ficha?.telas ?? []) {
    const ult = gruposTela[gruposTela.length - 1];
    const g = ult?.articulo === t.articulo ? ult : (gruposTela.push({ articulo: t.articulo, filas: [], metros: 0, kg: 0, costo: 0 }), gruposTela[gruposTela.length - 1]);
    g.filas.push(t); g.metros += t.metros; g.kg += t.kg; g.costo += t.costo;
  }

  const telasCosts = datos.telas.map(t => {
    const { pMetro, pM2, costo, merma } = telaCosto(t);
    return { ...t, pMetro, pM2, costo, merma };
  });

  // Fuente única de cálculo: la misma calcular() que usan el editor y la lista,
  // con los márgenes congelados en el escandallo. (Antes el PDF lo recalculaba
  // a mano y con otra fuente de márgenes → divergía de la lista.)
  const { costoTelas, costoServicios, costoMO, costoVarios, costoAvios, costoEmbolsado, costoBase, conDesarrollo, costoTotal } =
    calcular(datos, costoMinuto, { margenDesarrollo: datos.margenDesarrollo, margenFallas: datos.margenFallas });

  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  // Checklist de armado: qué rubros están cargados y cuáles quedaron en cero. Es solo lectura
  // de lo ya calculado — sirve para confirmar el costeo contra el producto sin ir a Materiales.
  type Chequeo = { label: string; estado: 'ok' | 'falta' | 'aviso'; detalle: string };
  const chequeos: Chequeo[] = [];
  // El editor deja siempre una fila de tela en blanco: no cuenta como tela cargada.
  const telasManuales = datos.telas.filter(t => t.nombre?.trim() || t.consumoMetros > 0 || t.precioKgNeto > 0);
  if (datos.costoTelaFicha != null) {
    const arts = new Set((ficha?.telas ?? []).map(t => t.articulo)).size;
    chequeos.push(ficha && ficha.telas.length > 0
      ? { label: 'Telas', estado: 'ok', detalle: `${arts} ${arts === 1 ? 'artículo' : 'artículos'} · ${ficha.telas.length} ${ficha.telas.length === 1 ? 'rollo' : 'rollos'} (ficha de corte)` }
      : { label: 'Telas', estado: 'falta', detalle: 'no se encontró la ficha de corte del SKU' });
    if (telasManuales.length > 0) {
      chequeos.push({ label: 'Telas cargadas a mano', estado: 'aviso', detalle: `${telasManuales.length} sin usar: el costo de tela viene de la ficha` });
    }
  } else {
    chequeos.push(telasManuales.length > 0
      ? { label: 'Telas', estado: 'ok', detalle: `${telasManuales.length} ${telasManuales.length === 1 ? 'cargada' : 'cargadas'} a mano` }
      : { label: 'Telas', estado: 'falta', detalle: 'sin telas cargadas' });
  }
  chequeos.push(
    { label: 'Corte',    estado: datos.costoCorte    > 0 ? 'ok' : 'falta', detalle: datos.costoCorte    > 0 ? fmt$(datos.costoCorte)    : 'sin cargar' },
    { label: 'Tizada',   estado: datos.costoTizada   > 0 ? 'ok' : 'falta', detalle: datos.costoTizada   > 0 ? fmt$(datos.costoTizada)   : 'sin cargar' },
    { label: 'Lavadero', estado: datos.costoLavadero > 0 ? 'ok' : 'falta', detalle: datos.costoLavadero > 0 ? fmt$(datos.costoLavadero) : 'sin cargar' },
  );
  if (datos.costoSublimacionFicha != null) {
    chequeos.push({ label: 'Sublimación', estado: datos.costoSublimacionFicha > 0 ? 'ok' : 'aviso', detalle: datos.costoSublimacionFicha > 0 ? fmt$(datos.costoSublimacionFicha) : 'en cero' });
  }
  chequeos.push(datos.tiempoConfeccion > 0
    ? (costoMinuto > 0
        ? { label: 'Confección', estado: 'ok',    detalle: `${datos.tiempoConfeccion} min × ${fmt$(costoMinuto)}/min` }
        : { label: 'Confección', estado: 'aviso', detalle: `${datos.tiempoConfeccion} min, pero el valor del minuto es $0 (faltan gastos fijos o costureras)` })
    : { label: 'Confección', estado: 'falta', detalle: 'sin minutos cargados' });
  const nAvios = datos.costoAviosFicha != null ? (ficha?.avios.length ?? 0) : (datos.avios.extras.length + [datos.avios.etiquetaPrincipal, datos.avios.etiquetaComposicion, datos.avios.bolsaPolipropileno].filter(v => v > 0).length);
  chequeos.push(costoAvios > 0
    ? { label: 'Avíos', estado: 'ok', detalle: `${nAvios} ${nAvios === 1 ? 'ítem' : 'ítems'}${datos.costoAviosFicha != null ? ' (ficha de corte)' : ''} · ${fmt$(costoAvios)}` }
    : { label: 'Avíos', estado: 'falta', detalle: 'sin cargar' });
  chequeos.push(datos.margenDesarrollo > 0 && datos.margenFallas > 0
    ? { label: 'Márgenes', estado: 'ok', detalle: `desarrollo ${datos.margenDesarrollo}% · fallas ${datos.margenFallas}%` }
    : { label: 'Márgenes', estado: 'aviso', detalle: `desarrollo ${datos.margenDesarrollo}% · fallas ${datos.margenFallas}%` });
  const faltantes = chequeos.filter(c => c.estado === 'falta').length;

  return (
    <div>
      {/* Barra de acción */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-stone-200 px-6 py-3 flex items-center gap-4">
        <Link href="/costos" className="text-sm text-stone-500 hover:text-stone-800 transition">← Volver</Link>
        <div className="flex-1" />
        <PrintButton />
      </div>

      {/* Documento */}
      <div className="max-w-2xl mx-auto px-8 py-10 print:px-0 print:py-0 print:max-w-full">

        {/* Encabezado */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-stone-900">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Ficha de Costo — Escandallo</p>
            <h1 className="text-2xl font-bold text-stone-900">{escandallo.nombre}</h1>
            {escandallo.nombreComercial && <p className="text-base text-violet-600 font-medium">{escandallo.nombreComercial}</p>}
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
          {ficha && (
            <p className="text-xs text-stone-400 mb-2">
              De la ficha de corte · OP <span className="font-mono">{ficha.orden.sku ?? 'S/SKU'}</span> · {ficha.orden.marca}
              {ficha.orden.fechaCorte ? ` · cortada el ${ficha.orden.fechaCorte.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })}` : ''}
              {ficha.orden.cantidad > 0 ? ` · ${ficha.orden.cantidad} u` : ''}
              {ficha.orden.cortador ? ` · ${ficha.orden.cortador}` : ''}
            </p>
          )}
          {ficha && ficha.telas.length > 0 ? (
            <>
              <div className="overflow-x-auto"><table className="w-full text-sm print:text-xs">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="text-left py-2 font-semibold text-stone-600 pr-4">Tela · Color</th>
                    <th className="text-left py-2 font-semibold text-stone-600 pr-3">Rollo</th>
                    <th className="text-right py-2 font-semibold text-stone-600 w-20">Metros</th>
                    <th className="text-right py-2 font-semibold text-stone-600 w-20">m/prenda</th>
                    <th className="text-right py-2 font-semibold text-stone-600 w-20">kg</th>
                    <th className="text-right py-2 font-semibold text-stone-600 w-24">$/kg</th>
                    <th className="text-right py-2 font-semibold text-stone-600 w-24">$/metro</th>
                    <th className="text-right py-2 font-semibold text-stone-600 w-24">Costo</th>
                  </tr>
                </thead>
                {gruposTela.map((g) => (
                  <tbody key={g.articulo}>
                    {g.filas.map((t) => (
                      <tr key={t.rolloId} className="border-b border-stone-100">
                        <td className="py-2.5 pr-4 text-stone-800">{t.articulo}{t.color ? ` · ${t.color}` : ''}</td>
                        <td className="py-2.5 pr-3 font-mono text-xs text-stone-500">{t.codigo}</td>
                        <td className="py-2.5 text-right tabular-nums text-stone-700">{fmtM(t.metros)}</td>
                        <td className="py-2.5 text-right tabular-nums text-stone-500">{fmtMU(t.metros / uds)}</td>
                        <td className="py-2.5 text-right tabular-nums text-stone-500">{fmtKg(t.kg)}</td>
                        <td className="py-2.5 text-right tabular-nums text-stone-700">{fmt$(t.precioKg)}</td>
                        <td className="py-2.5 text-right tabular-nums text-stone-700">{fmt$(t.precioMetro)}</td>
                        <td className="py-2.5 text-right font-semibold tabular-nums text-stone-900">{fmt$(t.costo)}</td>
                      </tr>
                    ))}
                    {/* Con varios rollos del mismo artículo, lo que importa es cuánto lleva
                        la prenda de ESA tela — el m/prenda de cada rollo suelto no dice nada. */}
                    {g.filas.length > 1 && (
                      <tr className="border-b border-stone-200 bg-stone-50">
                        <td colSpan={2} className="py-1.5 pr-4 text-stone-600 italic">Total {g.articulo}</td>
                        <td className="py-1.5 text-right tabular-nums font-semibold text-stone-700">{fmtM(g.metros)}</td>
                        <td className="py-1.5 text-right tabular-nums font-semibold text-stone-700">{fmtMU(g.metros / uds)}</td>
                        <td className="py-1.5 text-right tabular-nums text-stone-500">{fmtKg(g.kg)}</td>
                        <td colSpan={2} />
                        <td className="py-1.5 text-right tabular-nums font-semibold text-stone-700">{fmt$(g.costo)}</td>
                      </tr>
                    )}
                  </tbody>
                ))}
                <tfoot>
                  <tr className="border-t-2 border-stone-300">
                    <td colSpan={2} className="pt-3 font-bold text-stone-700">Total tizada{ficha.orden.cantidad > 0 ? ` (${ficha.orden.cantidad} u)` : ''}</td>
                    <td className="pt-3 text-right font-bold tabular-nums text-stone-700">{fmtM(ficha.totales.metros)}</td>
                    <td className="pt-3 text-right font-bold tabular-nums text-stone-700">{fmtMU(ficha.totales.metrosUnit)}</td>
                    <td className="pt-3 text-right font-bold tabular-nums text-stone-500">{fmtKg(ficha.totales.kg)}</td>
                    <td colSpan={2} />
                    <td className="pt-3 text-right font-bold tabular-nums text-stone-900">{fmt$(ficha.totales.costo)}</td>
                  </tr>
                </tfoot>
              </table></div>
              <div className="flex justify-between text-sm border-t border-stone-200 mt-2 pt-2">
                <span className="text-stone-600">Tela por prenda{ficha.orden.cantidad > 0 ? ` (÷ ${ficha.orden.cantidad} u)` : ''} · {fmtM(ficha.totales.metrosUnit)} m{ficha.totales.kgUnit > 0 ? ` · ${fmtKg(ficha.totales.kgUnit)} kg` : ''}</span>
                <span className="font-bold tabular-nums text-stone-900">{fmt$(costoTelas)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-sm border-b border-stone-100 py-2.5">
              <span className="text-stone-600">Tela (de la ficha de corte, incluye insumos del corte)</span>
              <span className="font-bold tabular-nums text-stone-900">{fmt$(costoTelas)}</span>
            </div>
          )}
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
                  <td className="py-2.5 pr-4 text-stone-800">{t.nombre || `Tela ${i + 1}`}{t.tipo === 'tira' ? ' · tira' : ''}</td>
                  <td className="py-2.5 text-right tabular-nums text-stone-700">{fmt$(t.precioKgNeto)}</td>
                  <td className="py-2.5 text-right tabular-nums text-stone-500">{t.fletePercent}%</td>
                  <td className="py-2.5 text-right tabular-nums text-stone-700">{t.rindeMetrosKg}</td>
                  <td className="py-2.5 text-right tabular-nums text-stone-700">{t.tipo === 'tira' ? `${fmt$(t.pM2)}/m²` : fmt$(t.pMetro)}</td>
                  <td className="py-2.5 text-right tabular-nums text-stone-700">{t.tipo === 'tira' ? `${t.anchoTiraCm ?? 0}×${t.largoTiraCm ?? 0}cm · ${(t.merma ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}% merma` : `${t.consumoMetros}m`}</td>
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
              ...(datos.costoSublimacionFicha ? [{ label: 'Sublimación', val: datos.costoSublimacionFicha }] : []),
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
            {/* Avíos traídos de la ficha de corte: el total ya sale de ahí, pero sin estas
                líneas el PDF mostraba solo "Total avíos" sin decir qué lleva la prenda. */}
            {datos.costoAviosFicha != null && (
              ficha && ficha.avios.length > 0 ? (
                <>
                  <p className="text-xs text-stone-400">De la ficha de corte</p>
                  {ficha.avios.map((a, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-stone-600">{a.nombre}{a.cantidad !== 1 ? ` (${a.cantidad} × ${fmt$(a.precio)})` : ''}</span>
                      <span className="tabular-nums font-semibold">{fmt$(a.costo)}</span>
                    </div>
                  ))}
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-stone-600">Avíos (de la ficha de corte)</span>
                  <span className="tabular-nums font-semibold">{fmt$(datos.costoAviosFicha)}</span>
                </div>
              )
            )}
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

        {/* Verificación: qué rubros están cargados y cuáles quedaron en cero */}
        <div className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Verificación</h2>
          <div className="rounded-xl border border-stone-200 divide-y divide-stone-100">
            {chequeos.map((c, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className={`w-5 shrink-0 text-center font-bold ${c.estado === 'ok' ? 'text-emerald-600' : c.estado === 'aviso' ? 'text-amber-500' : 'text-red-500'}`}>
                  {c.estado === 'ok' ? '✓' : c.estado === 'aviso' ? '!' : '✗'}
                </span>
                <span className={`font-medium ${c.estado === 'falta' ? 'text-red-600' : 'text-stone-700'}`}>{c.label}</span>
                <span className="flex-1 text-right text-stone-500 tabular-nums">{c.detalle}</span>
              </div>
            ))}
          </div>
          <p className={`text-xs mt-2 ${faltantes > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {faltantes > 0
              ? `${faltantes} ${faltantes === 1 ? 'rubro sin cargar' : 'rubros sin cargar'} — el costo total no los incluye.`
              : 'Todos los rubros del costeo están cargados.'}
          </p>
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
