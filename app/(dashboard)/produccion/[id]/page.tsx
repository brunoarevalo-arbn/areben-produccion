import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente', CORTE: 'Corte', COSTURA: 'Costura',
  TERMINADO_SIN_ESTAMPA: 'Liso terminado', ESTAMPA: 'Estampa',
  CONTROL_CALIDAD: 'Control calidad', CERRADA: 'Cerrada',
};
const ESTADO_BADGE: Record<string, 'success' | 'warning' | 'default' | 'amber' | 'blue' | 'violet' | 'pink'> = {
  PENDIENTE: 'amber', CORTE: 'blue', COSTURA: 'success',
  TERMINADO_SIN_ESTAMPA: 'violet', ESTAMPA: 'pink', CONTROL_CALIDAD: 'warning', CERRADA: 'default',
};

const fmt = (n: unknown) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

export default async function OrdenDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const orden = await prisma.ordenProduccion.findUnique({
    where: { id },
    include: {
      transiciones: { orderBy: { fecha: 'desc' } },
      cortesPorTalle: { orderBy: { talle: 'asc' } },
      pagoCorte: { select: { id: true, fecha: true, beneficiario: true, montoTotal: true } },
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
  const costoCorte = Number(orden.costoCorte);
  const costoMO = Number(orden.costoManoObra);
  const costoEstampa = Number(orden.costoEstampa);
  const costoTotal = Number(orden.costoTotal);

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        eyebrow="Producción / Orden"
        title={orden.sku ?? 'S/SKU'}
        subtitle={`${orden.descripcion || orden.marca} · ${orden.cantidad} unidades`}
        actions={<Badge variant={ESTADO_BADGE[orden.estado] ?? 'default'} size="md">{ESTADO_LABEL[orden.estado]}</Badge>}
      />

      {/* Costos */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-6">
        <h3 className="text-sm font-bold text-stone-800 mb-3">Costos acumulados</h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Tela</p>
            <p className="text-stone-800 tabular-nums font-semibold">{costoTela > 0 ? `$${fmt(costoTela)}` : '--'}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Insumos sec.</p>
            <p className="text-stone-800 tabular-nums">{costoInsSec > 0 ? `$${fmt(costoInsSec)}` : '--'}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Corte</p>
            <p className="text-stone-800 tabular-nums">
              {costoCorte > 0 ? `$${fmt(costoCorte)}` : '--'}
              {costoCorte > 0 && (
                <span className={`ml-1 text-xs font-semibold px-1.5 py-0.5 rounded-full ${orden.pagoCorteId ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {orden.pagoCorteId ? 'Pagado' : 'Pte.'}
                </span>
              )}
            </p>
            {orden.cortador && <p className="text-xs text-stone-400 mt-0.5">{orden.cortador}</p>}
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
        {!orden.fichaCorteCargada && (
          <Link href={`/produccion/${orden.id}/corte`}
            className="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
            Cargar ficha de corte{orden.estado === 'CERRADA' ? ' (orden cerrada)' : ''}
          </Link>
        )}
        {orden.fichaCorteCargada && (
          <Link href={`/produccion/${orden.id}/corte`}
            className="px-4 py-2.5 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition">
            Ver corte
          </Link>
        )}
      </div>

      {/* Talles cortados */}
      {orden.cortesPorTalle.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-6">
          <h3 className="text-sm font-bold text-stone-800 mb-3">Desglose por talle</h3>
          <div className="flex flex-wrap gap-3">
            {orden.cortesPorTalle.map((c) => (
              <div key={c.id} className="bg-stone-50 rounded-lg px-4 py-2 text-sm border border-stone-200">
                <span className="text-stone-500 mr-2">{c.talle}</span>
                <strong className="text-stone-900 text-lg tabular-nums">{c.cantidad}</strong>
              </div>
            ))}
            <div className="bg-stone-900 text-white rounded-lg px-4 py-2 text-sm ml-auto">
              <span className="opacity-70 mr-2">Total</span>
              <strong className="text-lg tabular-nums">{orden.cortesPorTalle.reduce((s, c) => s + c.cantidad, 0)}</strong>
            </div>
          </div>
        </div>
      )}

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
                <Badge variant={ESTADO_BADGE[t.estadoNuevo] ?? 'default'} size="sm">{ESTADO_LABEL[t.estadoNuevo]}</Badge>
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
