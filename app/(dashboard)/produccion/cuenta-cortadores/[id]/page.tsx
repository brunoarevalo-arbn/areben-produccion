import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { RegistrarPagoCortador } from '@/components/produccion/cortador/RegistrarPagoCortador';
import { pagosACuentaDe, esPagoACuenta } from '@/lib/produccion/cuenta-cortador';

export const dynamic = 'force-dynamic';
const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
const fechaCorta = (d: Date) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' });

export default async function CuentaCortadorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cortador = await prisma.cortador.findUnique({ where: { id }, select: { id: true, nombre: true } });
  if (!cortador) notFound();

  const [cortesRaw, muestrasRaw, pagos, aCuenta] = await Promise.all([
    prisma.ordenProduccion.findMany({
      where: { cortadorId: id, costoCorte: { gt: 0 }, pagoCorteId: null, OR: [{ fichaCorteCargada: true }, { corteEstado: 'validado' }] },
      select: { id: true, sku: true, costoCorte: true, fechaCorte: true }, orderBy: { fechaCorte: 'asc' },
    }),
    prisma.corteMuestra.findMany({
      where: { cortadorId: id, estado: 'validado', pagoCorteId: null },
      select: { id: true, descripcion: true, valor: true, fecha: true }, orderBy: { fecha: 'asc' },
    }),
    // El `cortadorId` suelto es lo que trae los pagos A CUENTA, que no tienen ítems
    // de los que colgar: sin él no aparecerían nunca en el historial.
    prisma.pagoCorte.findMany({
      where: { OR: [{ cortadorId: id }, { ordenes: { some: { cortadorId: id } } }, { muestras: { some: { cortadorId: id } } }] },
      select: { id: true, fecha: true, montoTotal: true, notas: true, _count: { select: { ordenes: true, muestras: true } } },
      orderBy: { fecha: 'desc' }, take: 30,
    }),
    pagosACuentaDe(id),
  ]);

  const cortes = cortesRaw.map((c) => ({ id: c.id, sku: c.sku, costoCorte: Number(c.costoCorte), fecha: c.fechaCorte ? c.fechaCorte.toISOString() : null }));
  const muestras = muestrasRaw.map((m) => ({ id: m.id, descripcion: m.descripcion, valor: Number(m.valor), fecha: m.fecha.toISOString() }));
  const totalCortes = cortes.reduce((s, c) => s + c.costoCorte, 0);
  const totalMuestras = muestras.reduce((s, m) => s + m.valor, 0);
  const saldo = totalCortes + totalMuestras - aCuenta;

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <Link href="/produccion/cuenta-cortadores" className="text-sm text-stone-500 hover:text-stone-800 transition">← Cuenta de cortadores</Link>
      <PageHeader
        eyebrow="Producción / Cuenta corriente"
        title={cortador.nombre}
        subtitle={saldo < 0 ? `Saldo a favor: ${fmt$(-saldo)}` : `Saldo pendiente: ${fmt$(saldo)}`}
      />

      <Card padding="none" className="p-5 space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-stone-500">Cortes pendientes</span><span className="tabular-nums text-stone-800">{fmt$(totalCortes)}</span></div>
        <div className="flex justify-between"><span className="text-stone-500">Muestras validadas</span><span className="tabular-nums text-stone-800">{fmt$(totalMuestras)}</span></div>
        <div className="flex justify-between"><span className="text-stone-500">Pagos a cuenta</span><span className="tabular-nums text-stone-800">−{fmt$(aCuenta)}</span></div>
        <div className="flex justify-between border-t border-stone-100 pt-1.5 font-bold">
          <span className="text-stone-800">{saldo < 0 ? 'Saldo a favor' : 'Saldo'}</span>
          <span className={`tabular-nums ${saldo > 0 ? 'text-amber-700' : saldo < 0 ? 'text-emerald-600' : 'text-stone-400'}`}>{fmt$(Math.abs(saldo))}</span>
        </div>
      </Card>

      <section>
        <h2 className="text-sm font-bold text-stone-800 mb-3">Registrar un pago</h2>
        <RegistrarPagoCortador cortadorId={cortador.id} cortadorNombre={cortador.nombre} cortes={cortes} muestras={muestras} />
      </section>

      <section>
        <h2 className="text-sm font-bold text-stone-800 mb-3">Historial de pagos</h2>
        {pagos.length === 0 ? (
          <Card padding="none" className="p-6 text-center text-sm text-stone-400">Sin pagos registrados.</Card>
        ) : (
          <Card padding="none" className="divide-y divide-stone-100">
            {pagos.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="text-stone-500 shrink-0">{fechaCorta(p.fecha)}</span>
                {esPagoACuenta(p) ? (
                  <span className="text-xs text-stone-400 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 mr-1.5">a cuenta</span>
                    {p.notas ?? 'sin imputar a un corte'}
                  </span>
                ) : (
                  <span className="text-xs text-stone-400 flex-1">{p._count.ordenes} corte(s){p._count.muestras > 0 ? ` · ${p._count.muestras} muestra(s)` : ''}{p.notas ? ` · ${p.notas}` : ''}</span>
                )}
                <span className="font-semibold text-stone-800 tabular-nums shrink-0">{fmt$(Number(p.montoTotal))}</span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
