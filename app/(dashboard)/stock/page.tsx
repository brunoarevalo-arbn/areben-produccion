import { prisma } from '@/lib/prisma';
import { necesitaReposicion } from '@/lib/utils/calculos';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function StockPage() {
  const stock = await prisma.stock.findMany({
    include: {
      producto: {
        select: { id: true, nombre: true, marca: true, temporada: true },
      },
    },
    orderBy: { producto: { nombre: 'asc' } },
  });

  const alertas = stock.filter((s) => necesitaReposicion(s.cantidadLocal, s.stockMinimo));

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">Inventario</span>
          <h1 className="text-2xl font-bold text-stone-900 mt-1">Stock</h1>
          <div className="flex gap-4 mt-2 text-sm text-stone-500">
            <span>{stock.length} productos</span>
            {alertas.length > 0 && (
              <span className="text-red-600 font-medium">⚠ {alertas.length} con stock bajo</span>
            )}
          </div>
        </div>
        <Link href="/stock/reposicion"
          className="text-sm border border-stone-200 hover:border-stone-400 text-stone-600 px-4 py-2 rounded-xl transition">
          Ver reposiciones →
        </Link>
      </div>

      {stock.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-16 text-center">
          <div className="text-5xl mb-4">📦</div>
          <h2 className="text-lg font-semibold text-stone-700 mb-2">Sin stock registrado</h2>
          <p className="text-stone-400 text-sm">
            El inventario se actualiza automáticamente cuando se registran movimientos de producción.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left">
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-stone-400">Producto</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-stone-400 text-center">Depósito</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-stone-400 text-center">Local</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-stone-400 text-center">Mínimo</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-stone-400 text-right">P. Venta</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-stone-400 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((s) => {
                const bajo = necesitaReposicion(s.cantidadLocal, s.stockMinimo);
                return (
                  <tr key={s.id} className="border-b border-stone-50 hover:bg-stone-50 transition">
                    <td className="px-5 py-3">
                      <Link href={`/diseno/${s.producto.id}`} className="font-medium text-stone-800 hover:text-violet-700">
                        {s.producto.nombre}
                      </Link>
                      {s.producto.marca && (
                        <span className="text-stone-400 text-xs ml-2">{s.producto.marca}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center font-semibold text-stone-700">{s.cantidadDeposito}</td>
                    <td className={`px-5 py-3 text-center font-bold ${bajo ? 'text-red-600' : 'text-stone-700'}`}>
                      {s.cantidadLocal}
                    </td>
                    <td className="px-5 py-3 text-center text-stone-400">{s.stockMinimo}</td>
                    <td className="px-5 py-3 text-right text-stone-700 font-medium">
                      {s.precioVenta > 0 ? `$${s.precioVenta.toFixed(0)}` : '—'}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                        bajo
                          ? 'bg-red-100 text-red-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {bajo ? 'Reponer' : 'OK'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
