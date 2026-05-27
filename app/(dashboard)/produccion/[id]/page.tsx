import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente', CORTE: 'Corte', COSTURA: 'Costura',
  TERMINADO_SIN_ESTAMPA: 'Term. sin estampa', ESTAMPA: 'Estampa',
  CONTROL_CALIDAD: 'Control calidad', CERRADA: 'Cerrada',
};
const ESTADO_COLOR: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700', CORTE: 'bg-blue-100 text-blue-700',
  COSTURA: 'bg-emerald-100 text-emerald-700', TERMINADO_SIN_ESTAMPA: 'bg-violet-100 text-violet-700',
  ESTAMPA: 'bg-pink-100 text-pink-700', CONTROL_CALIDAD: 'bg-orange-100 text-orange-700',
  CERRADA: 'bg-stone-100 text-stone-500',
};

const fmt = (n: unknown) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

export default async function OrdenDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const orden = await prisma.ordenProduccion.findUnique({
    where: { id },
    include: {
      transiciones: { orderBy: { fecha: 'desc' } },
      movimientosInsumo: {
        include: {
          rollo: { select: { codigo: true, insumo: { select: { nombre: true } }, color: { select: { nombre: true } } } },
          lote: { select: { codigo: true, insumo: { select: { nombre: true } }, color: { select: { nombre: true } } } },
        },
        orderBy: { fecha: 'desc' },
      },
    },
  });

  if (!orden) notFound();

  const costoTela = Number(orden.costoTela);
  const costoInsSec = Number(orden.costoInsumosSecundarios);
  const costoMO = Number(orden.costoManoObra);
  const costoEstampa = Number(orden.costoEstampa);
  const costoTotal = Number(orden.costoTotal);

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Produccion</span>
        <div className="flex items-center gap-3 mt-1">
          <h1 className="text-2xl font-bold text-stone-900 font-mono">{orden.sku}</h1>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ESTADO_COLOR[orden.estado] || ''}`}>
            {ESTADO_LABEL[orden.estado]}
          </span>
        </div>
        <p className="text-stone-500 text-sm mt-1">{orden.descripcion || orden.marca} · {orden.cantidad} unidades</p>
      </div>

      {/* Costos */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-6">
        <h3 className="text-sm font-bold text-stone-800 mb-3">Costos acumulados</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Tela</p>
            <p className="text-stone-800 tabular-nums font-semibold">{costoTela > 0 ? `$${fmt(costoTela)}` : '--'}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Insumos sec.</p>
            <p className="text-stone-800 tabular-nums">{costoInsSec > 0 ? `$${fmt(costoInsSec)}` : '--'}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Mano de obra</p>
            <p className="text-stone-800 tabular-nums">{costoMO > 0 ? `$${fmt(costoMO)}` : '--'}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Estampa</p>
            <p className="text-stone-800 tabular-nums">{costoEstampa > 0 ? `$${fmt(costoEstampa)}` : '--'}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Total</p>
            <p className="text-stone-800 tabular-nums font-bold text-lg">{costoTotal > 0 ? `$${fmt(costoTotal)}` : '--'}</p>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-3 mb-6">
        {!orden.fichaCorteCargada && (orden.estado === 'PENDIENTE' || orden.estado === 'CORTE') && (
          <Link href={`/produccion/${orden.id}/ficha`}
            className="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
            Cargar ficha de corte
          </Link>
        )}
        {orden.fichaCorteCargada && (
          <Link href={`/produccion/${orden.id}/ficha`}
            className="px-4 py-2.5 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition">
            Ver ficha de corte
          </Link>
        )}
      </div>

      {/* Historial de estados */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-6">
        <h3 className="text-sm font-bold text-stone-800 mb-3">Historial de estados</h3>
        {orden.transiciones.length === 0 ? (
          <p className="text-sm text-stone-400">Sin transiciones</p>
        ) : (
          <div className="space-y-2">
            {orden.transiciones.map((t) => (
              <div key={t.id} className="flex items-center gap-3 text-sm">
                <span className="text-xs text-stone-400 whitespace-nowrap w-36">
                  {new Date(t.fecha).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                {t.estadoAnterior && (
                  <span className="text-xs text-stone-500">{ESTADO_LABEL[t.estadoAnterior]}</span>
                )}
                <span className="text-stone-400">→</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ESTADO_COLOR[t.estadoNuevo] || ''}`}>
                  {ESTADO_LABEL[t.estadoNuevo]}
                </span>
                {t.notas && <span className="text-xs text-stone-500 truncate">{t.notas}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Movimientos de insumo */}
      {orden.movimientosInsumo.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <h3 className="text-sm font-bold text-stone-800 mb-3">Consumos de insumo</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-stone-400 uppercase tracking-widest border-b border-stone-100">
                <th className="text-left py-2 font-bold">Tipo</th>
                <th className="text-left py-2 font-bold">Recurso</th>
                <th className="text-right py-2 font-bold">Cantidad</th>
                <th className="text-left py-2 font-bold">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {orden.movimientosInsumo.map((m) => {
                const recurso = m.rollo
                  ? `${m.rollo.codigo} · ${m.rollo.insumo.nombre}${m.rollo.color ? ` · ${m.rollo.color.nombre}` : ''}`
                  : m.lote
                  ? `${m.lote.codigo} · ${m.lote.insumo.nombre}${m.lote.color ? ` · ${m.lote.color.nombre}` : ''}`
                  : '--';
                return (
                  <tr key={m.id} className="border-b border-stone-50">
                    <td className="py-2 text-xs">{m.tipo}</td>
                    <td className="py-2 text-stone-700">{recurso}</td>
                    <td className={`py-2 text-right tabular-nums font-semibold ${Number(m.cantidad) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {Number(m.cantidad) >= 0 ? '+' : ''}{fmt(m.cantidad)}
                    </td>
                    <td className="py-2 text-xs text-stone-500">{m.motivo || '--'}</td>
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
