import { prisma } from '@/lib/prisma';
import { necesitaReposicion } from '@/lib/utils/calculos';

export default async function ReposicionPage() {
  const alertas = await prisma.stock.findMany({
    include: { producto: { select: { id: true, nombre: true, marca: true } } },
    orderBy: { producto: { nombre: 'asc' } },
  });

  const necesitan = alertas.filter((s) => necesitaReposicion(s.cantidadLocal, s.stockMinimo));

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">Stock</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Reposición</h1>
        <p className="text-stone-500 text-sm mt-1">
          Productos cuyo stock en local está por debajo del mínimo.
        </p>
      </div>

      {necesitan.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-emerald-700 font-semibold">Todo el stock está en orden</p>
        </div>
      ) : (
        <div className="space-y-3">
          {necesitan.map((s) => {
            const faltante = s.stockMinimo - s.cantidadLocal;
            const disponibleDeposito = s.cantidadDeposito;

            return (
              <div key={s.id} className="bg-white rounded-2xl border-l-4 border-red-400 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-stone-900">{s.producto.nombre}</p>
                    {s.producto.marca && <p className="text-stone-400 text-xs mt-0.5">{s.producto.marca}</p>}
                  </div>
                  <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">
                    Reponer {faltante} unid.
                  </span>
                </div>

                <div className="flex gap-6 mt-3 text-sm">
                  <div>
                    <p className="text-stone-400 text-xs">En local</p>
                    <p className="font-bold text-red-600">{s.cantidadLocal}</p>
                  </div>
                  <div>
                    <p className="text-stone-400 text-xs">Mínimo</p>
                    <p className="font-bold text-stone-700">{s.stockMinimo}</p>
                  </div>
                  <div>
                    <p className="text-stone-400 text-xs">Depósito disponible</p>
                    <p className={`font-bold ${disponibleDeposito >= faltante ? 'text-emerald-600' : 'text-orange-500'}`}>
                      {disponibleDeposito}
                    </p>
                  </div>
                </div>

                {disponibleDeposito < faltante && (
                  <p className="text-orange-600 text-xs mt-2 bg-orange-50 px-3 py-1.5 rounded-lg">
                    ⚠ Stock en depósito insuficiente — necesitás producir más unidades.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
