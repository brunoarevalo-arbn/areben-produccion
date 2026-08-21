import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { RegistrarPagoCortador } from '@/components/produccion/cortador/RegistrarPagoCortador';
import { AnularPagoBtn } from '@/components/produccion/cortador/AnularPagoBtn';
import { cuentaDe, movimientosDe, CORTE_COBRABLE, MUESTRA_COBRABLE, SIN_IMPUTAR } from '@/lib/produccion/cuenta-cortador';

export const dynamic = 'force-dynamic';
const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
const fechaCorta = (d: Date) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' });

export default async function CuentaCortadorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cortador = await prisma.cortador.findUnique({ where: { id }, select: { id: true, nombre: true } });
  if (!cortador) notFound();

  // Los cortes/muestras SIN imputar son sólo lo que se ofrece para tildar al cargar un
  // pago: es trazabilidad, no plata. La cuenta la da `cuentaDe`, que los cuenta a todos.
  const [cuenta, movimientos, cortesRaw, muestrasRaw] = await Promise.all([
    cuentaDe(id),
    movimientosDe(id),
    prisma.ordenProduccion.findMany({
      where: { cortadorId: id, ...CORTE_COBRABLE, ...SIN_IMPUTAR },
      select: { id: true, sku: true, costoCorte: true, fechaCorte: true }, orderBy: { fechaCorte: 'asc' },
    }),
    prisma.corteMuestra.findMany({
      where: { cortadorId: id, ...MUESTRA_COBRABLE, ...SIN_IMPUTAR },
      select: { id: true, descripcion: true, valor: true, fecha: true }, orderBy: { fecha: 'asc' },
    }),
  ]);

  const cortes = cortesRaw.map((c) => ({ id: c.id, sku: c.sku, costoCorte: Number(c.costoCorte), fecha: c.fechaCorte ? c.fechaCorte.toISOString() : null }));
  const muestras = muestrasRaw.map((m) => ({ id: m.id, descripcion: m.descripcion, valor: Number(m.valor), fecha: m.fecha.toISOString() }));
  const { saldo } = cuenta;

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <Link href="/produccion/cuenta-cortadores" className="text-sm text-stone-500 hover:text-stone-800 transition">← Cuenta de cortadores</Link>
      <PageHeader
        eyebrow="Producción / Cuenta corriente"
        title={cortador.nombre}
        subtitle={saldo < 0 ? `Saldo a favor: ${fmt$(-saldo)}` : `Saldo pendiente: ${fmt$(saldo)}`}
      />

      <Card padding="none" className="p-5 space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-stone-500">Cortes <span className="text-stone-300">({cuenta.nCortes})</span></span><span className="tabular-nums text-stone-800">{fmt$(cuenta.cortes)}</span></div>
        <div className="flex justify-between"><span className="text-stone-500">Muestras <span className="text-stone-300">({cuenta.nMuestras})</span></span><span className="tabular-nums text-stone-800">{fmt$(cuenta.muestras)}</span></div>
        <div className="flex justify-between"><span className="text-stone-500">Pagos <span className="text-stone-300">({cuenta.nPagos})</span></span><span className="tabular-nums text-stone-800">−{fmt$(cuenta.pagos)}</span></div>
        <div className="flex justify-between border-t border-stone-100 pt-1.5 font-bold">
          <span className="text-stone-800">{saldo < 0 ? 'Saldo a favor' : 'Saldo'}</span>
          <span className={`tabular-nums ${saldo > 0 ? 'text-amber-700' : saldo < 0 ? 'text-emerald-600' : 'text-stone-400'}`}>{fmt$(Math.abs(saldo))}</span>
        </div>
      </Card>

      <section>
        <h2 className="text-sm font-bold text-stone-800 mb-3">Registrar un pago</h2>
        <RegistrarPagoCortador cortadorId={cortador.id} cortadorNombre={cortador.nombre} cortes={cortes} muestras={muestras} saldo={saldo} />
      </section>

      <section>
        <h2 className="text-sm font-bold text-stone-800 mb-1">Movimientos</h2>
        <p className="text-xs text-stone-400 mb-3">Todo lo cortado al debe, todo lo pagado al haber. Imputar un corte a un pago no mueve el saldo: es sólo la traza de qué cubrió cada pago.</p>
        {movimientos.length === 0 ? (
          <Card padding="none" className="p-6 text-center text-sm text-stone-400">Sin movimientos.</Card>
        ) : (
          <Card padding="none" className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-stone-400 border-b border-stone-100">
                  <th className="text-left px-4 py-2.5 font-bold">Fecha</th>
                  <th className="text-left px-4 py-2.5 font-bold">Concepto</th>
                  <th className="text-right px-4 py-2.5 font-bold">Debe</th>
                  <th className="text-right px-4 py-2.5 font-bold">Haber</th>
                  <th className="text-right px-4 py-2.5 font-bold">Saldo</th>
                  <th className="px-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {movimientos.map((m) => (
                  <tr key={`${m.tipo}-${m.id}`} className={m.tipo === 'pago' ? 'bg-emerald-50/40' : ''}>
                    <td className="px-4 py-2 text-stone-500 whitespace-nowrap">{fechaCorta(m.fecha)}</td>
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2 flex-wrap">
                        {m.tipo === 'corte' && <span className="font-mono text-xs bg-stone-100 px-2 py-0.5 rounded text-stone-700">{m.concepto}</span>}
                        {m.tipo === 'muestra' && <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded">muestra</span>}
                        {m.tipo === 'pago' && <span className="text-xs font-semibold text-emerald-700">Pago</span>}
                        <span className="text-xs text-stone-400 truncate max-w-[18rem]">{m.detalle ?? (m.tipo === 'corte' ? 'corte' : '')}</span>
                        {m.imputadoEl && <span className="text-[10px] text-stone-400 border border-stone-200 rounded px-1.5 py-0.5">pagado {fechaCorta(m.imputadoEl)}</span>}
                        {m.tipo === 'pago' && m.nItems > 0 && <span className="text-[10px] text-stone-400 border border-stone-200 rounded px-1.5 py-0.5">{m.nItems} ítem(s)</span>}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-stone-700">{m.debe ? fmt$(m.debe) : ''}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{m.haber ? fmt$(m.haber) : ''}</td>
                    <td className={`px-4 py-2 text-right tabular-nums font-semibold ${m.saldo < 0 ? 'text-emerald-600' : 'text-stone-800'}`}>{fmt$(m.saldo)}</td>
                    <td className="px-2 py-2 text-right">
                      {m.tipo === 'pago' && <AnularPagoBtn pagoId={m.id} monto={m.haber} nItems={m.nItems} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
