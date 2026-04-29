import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function fmt$(n: number) { return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export default async function EscandalloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [escandallo, gastos, costureras] = await Promise.all([
    prisma.escandallo.findUnique({
      where: { id },
      include: { materiales: { orderBy: { orden: 'asc' } } },
    }),
    prisma.gastoFijoTaller.findMany({ where: { activo: true } }),
    prisma.costoCosturera.findMany(),
  ]);

  if (!escandallo) notFound();

  const totalGastos   = gastos.reduce((s, g) => s + g.monto, 0);
  const totalCosturas = costureras.reduce((s, c) => s + c.sueldoBruto + c.cargasSociales, 0);
  const totalHoras    = costureras.reduce((s, c) => s + c.horasMes, 0);
  const valorHora     = totalHoras > 0 ? (totalGastos + totalCosturas) / totalHoras : 0;
  const costoMinuto   = valorHora / 60;

  const costoMateriales = escandallo.materiales.reduce((s, m) => s + m.cantidad * m.costoUnitario, 0);
  const costoTotal      = costoMateriales;
  const precioSugerido  = costoTotal * escandallo.margen;

  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div>
      {/* Barra de acción (no imprime) */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-stone-200 px-6 py-3 flex items-center gap-4">
        <Link href="/costos" className="text-sm text-stone-500 hover:text-stone-800 transition">← Volver</Link>
        <div className="flex-1" />
        <button
          onClick={() => window.print()}
          className="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2 rounded-xl text-sm font-semibold transition"
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      {/* Documento */}
      <div className="max-w-2xl mx-auto px-8 py-10 print:px-0 print:py-0 print:max-w-full">

        {/* Encabezado */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-stone-900">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Ficha de Costo — Escandallo</p>
            <h1 className="text-2xl font-bold text-stone-900">{escandallo.nombre}</h1>
            <div className="flex items-center gap-3 mt-2">
              {escandallo.sku  && <span className="font-mono text-sm bg-stone-100 px-2 py-0.5 rounded text-stone-700">{escandallo.sku}</span>}
              {escandallo.marca && <span className="text-sm text-stone-500">{escandallo.marca}</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-stone-400">Areben</p>
            <p className="text-xs text-stone-400">{fecha}</p>
          </div>
        </div>

        {/* Materiales */}
        <div className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Materiales e insumos</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left py-2 font-semibold text-stone-600 pr-4">Ítem</th>
                <th className="text-center py-2 font-semibold text-stone-600 w-20">Cant.</th>
                <th className="text-center py-2 font-semibold text-stone-600 w-16">Unid.</th>
                <th className="text-right py-2 font-semibold text-stone-600 w-28">$/unid.</th>
                <th className="text-right py-2 font-semibold text-stone-600 w-28">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {escandallo.materiales.map((m, i) => (
                <tr key={i} className="border-b border-stone-100">
                  <td className="py-2.5 pr-4 text-stone-800">{m.nombre}</td>
                  <td className="py-2.5 text-center text-stone-700 tabular-nums">{m.cantidad}</td>
                  <td className="py-2.5 text-center text-stone-500">{m.unidad}</td>
                  <td className="py-2.5 text-right text-stone-700 tabular-nums">{fmt$(m.costoUnitario)}</td>
                  <td className="py-2.5 text-right font-semibold text-stone-900 tabular-nums">{fmt$(m.cantidad * m.costoUnitario)}</td>
                </tr>
              ))}
              {escandallo.materiales.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-stone-400 text-sm italic">Sin materiales</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-300">
                <td colSpan={4} className="pt-3 font-bold text-stone-700">Total materiales</td>
                <td className="pt-3 text-right font-bold text-stone-900 tabular-nums">{fmt$(costoMateriales)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Parámetros del taller */}
        <div className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Parámetros del taller</h2>
          <div className="bg-stone-50 rounded-xl p-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-stone-400 mb-1">Gastos fijos / mes</p>
              <p className="font-bold text-stone-800">{fmt$(totalGastos)}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400 mb-1">Costo costureras / mes</p>
              <p className="font-bold text-stone-800">{fmt$(totalCosturas)}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400 mb-1">Valor hora taller</p>
              <p className="font-bold text-violet-700">{fmt$(Math.round(valorHora))}/h</p>
            </div>
          </div>
        </div>

        {/* Resumen de costos */}
        <div className="mb-8 border-t-2 border-stone-900 pt-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-4">Resumen de costos</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-stone-600">Costo de materiales</span>
              <span className="font-semibold tabular-nums">{fmt$(costoMateriales)}</span>
            </div>
            <div className="flex justify-between text-sm text-stone-400 italic">
              <span>Mano de obra (completar en escandallo)</span>
              <span>—</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2 border-t border-stone-200">
              <span>Costo total</span>
              <span className="tabular-nums">{fmt$(costoTotal)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 bg-stone-900 text-white rounded-xl px-4 py-3 mt-3">
              <div>
                <p className="text-xs text-stone-400">Precio sugerido (×{escandallo.margen})</p>
                <p className="text-2xl font-bold tabular-nums">{fmt$(precioSugerido)}</p>
              </div>
              <div className="text-right text-xs text-stone-400">
                <p>Margen: ×{escandallo.margen}</p>
                <p>Ganancia: {fmt$(precioSugerido - costoTotal)}</p>
              </div>
            </div>
          </div>
        </div>

        {escandallo.notas && (
          <div className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Notas</h2>
            <p className="text-sm text-stone-600">{escandallo.notas}</p>
          </div>
        )}

        <p className="text-xs text-stone-300 text-center mt-10">Generado por Areben · {fecha}</p>
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
