import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { RegistrarPagoCortador } from '@/components/produccion/cortador/RegistrarPagoCortador';

export const dynamic = 'force-dynamic';
const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
const fechaCorta = (d: Date) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' });

export default async function CuentaCortadorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cortador = await prisma.cortador.findUnique({ where: { id }, select: { id: true, nombre: true } });
  if (!cortador) notFound();

  const [cortesRaw, muestrasRaw, pagos] = await Promise.all([
    prisma.ordenProduccion.findMany({
      where: { cortadorId: id, costoCorte: { gt: 0 }, pagoCorteId: null, OR: [{ fichaCorteCargada: true }, { corteEstado: 'validado' }] },
      select: { id: true, sku: true, costoCorte: true, fechaCorte: true }, orderBy: { fechaCorte: 'asc' },
    }),
    prisma.corteMuestra.findMany({
      where: { cortadorId: id, estado: 'validado', pagoCorteId: null },
      select: { id: true, descripcion: true, valor: true, fecha: true }, orderBy: { fecha: 'asc' },
    }),
    prisma.pagoCorte.findMany({
      where: { OR: [{ ordenes: { some: { cortadorId: id } } }, { muestras: { some: { cortadorId: id } } }] },
      select: { id: true, fecha: true, montoTotal: true, notas: true, _count: { select: { ordenes: true, muestras: true } } },
      orderBy: { fecha: 'desc' }, take: 30,
    }),
  ]);

  const cortes = cortesRaw.map((c) => ({ id: c.id, sku: c.sku, costoCorte: Number(c.costoCorte), fecha: c.fechaCorte ? c.fechaCorte.toISOString() : null }));
  const muestras = muestrasRaw.map((m) => ({ id: m.id, descripcion: m.descripcion, valor: Number(m.valor), fecha: m.fecha.toISOString() }));
  const saldo = cortes.reduce((s, c) => s + c.costoCorte, 0) + muestras.reduce((s, m) => s + m.valor, 0);

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <Link href="/produccion/cuenta-cortadores" className="text-sm text-stone-500 hover:text-stone-800 transition">← Cuenta de cortadores</Link>
      <PageHeader eyebrow="Producción / Cuenta corriente" title={cortador.nombre} subtitle={`Saldo pendiente: ${fmt$(saldo)}`} />

      <section>
        <h2 className="text-sm font-bold text-stone-800 mb-3">Pendiente de pago · <span className="text-amber-700">{fmt$(saldo)}</span></h2>
        <RegistrarPagoCortador cortadorNombre={cortador.nombre} cortes={cortes} muestras={muestras} />
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
                <span className="text-xs text-stone-400 flex-1">{p._count.ordenes} corte(s){p._count.muestras > 0 ? ` · ${p._count.muestras} muestra(s)` : ''}{p.notas ? ` · ${p.notas}` : ''}</span>
                <span className="font-semibold text-stone-800 tabular-nums shrink-0">{fmt$(Number(p.montoTotal))}</span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
