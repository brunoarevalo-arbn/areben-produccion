import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

export default async function CortadorPanelPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect('/login');

  const cortador = await prisma.cortador.findFirst({ where: { usuarioId: session.id } });

  if (!cortador) {
    return (
      <div className="p-8 max-w-2xl">
        <PageHeader eyebrow="Cortador" title="Mi panel de cortes" />
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-800">
          Tu usuario todavía no está vinculado a un cortador. Pedile a administración que lo vincule (Producción → Cortadores).
        </div>
      </div>
    );
  }

  const ordenes = await prisma.ordenProduccion.findMany({
    where: { cortadorId: cortador.id },
    orderBy: [{ createdAt: 'desc' }],
    select: { id: true, sku: true, descripcion: true, marca: true, cantidad: true, fichaCorteCargada: true, corteEstado: true, costoCorte: true, fechaCorte: true },
  });

  const pendientes = ordenes.filter((o) => !o.fichaCorteCargada);
  const historicos = ordenes.filter((o) => o.fichaCorteCargada);
  const totalUnidHist = historicos.reduce((s, o) => s + o.cantidad, 0);
  const totalCobrado  = historicos.reduce((s, o) => s + Number(o.costoCorte), 0);

  return (
    <div className="p-8 max-w-3xl space-y-8">
      <PageHeader eyebrow="Cortador" title={`Hola, ${cortador.nombre}`} subtitle="Cargá tus cortes: tizadas, talles y precio. El taller asigna la tela." />

      {/* Pendientes */}
      <section>
        <h2 className="text-sm font-bold text-stone-800 mb-3">Cortes por cargar {pendientes.length > 0 && <span className="text-amber-600">({pendientes.length})</span>}</h2>
        {pendientes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 text-center text-sm text-stone-400">No tenés cortes asignados pendientes.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
            {pendientes.map((o) => (
              <div key={o.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs bg-stone-100 px-2 py-0.5 rounded text-stone-700">{o.sku ?? 'S/SKU'}</span>
                    <span className="text-xs text-stone-400">{o.marca}</span>
                    {o.corteEstado === 'cargado' && <span className="text-xs font-semibold text-blue-600">✓ cargado (esperando al taller)</span>}
                  </div>
                  {o.descripcion && <p className="text-sm text-stone-600 mt-1 truncate">{o.descripcion}</p>}
                </div>
                <span className="text-xs text-stone-400 tabular-nums shrink-0">{o.cantidad} u</span>
                <Link href={`/cortador/${o.id}`} className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold transition">
                  {o.corteEstado === 'cargado' ? 'Editar' : 'Cargar corte'}
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Resumen + históricos */}
      <section>
        <h2 className="text-sm font-bold text-stone-800 mb-3">Cortes hechos</h2>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="bg-white rounded-2xl border border-stone-200 p-4"><p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Cortes</p><p className="text-lg font-bold text-stone-800">{historicos.length}</p></div>
          <div className="bg-white rounded-2xl border border-stone-200 p-4"><p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Unidades</p><p className="text-lg font-bold text-stone-800 tabular-nums">{totalUnidHist}</p></div>
          <div className="bg-white rounded-2xl border border-stone-200 p-4"><p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Cobrado</p><p className="text-lg font-bold text-stone-800 tabular-nums">{fmt$(totalCobrado)}</p></div>
        </div>
        {historicos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 text-center text-sm text-stone-400">Todavía no hay cortes procesados.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
            {historicos.map((o) => (
              <div key={o.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs bg-stone-100 px-2 py-0.5 rounded text-stone-700">{o.sku ?? 'S/SKU'}</span>
                  {o.descripcion && <span className="text-sm text-stone-500 ml-2 truncate">{o.descripcion}</span>}
                </div>
                {o.fechaCorte && <span className="text-xs text-stone-400 shrink-0">{new Date(o.fechaCorte).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' })}</span>}
                <span className="text-xs text-stone-400 tabular-nums shrink-0">{o.cantidad} u</span>
                <span className="text-xs font-semibold text-stone-700 tabular-nums shrink-0 w-20 text-right">{fmt$(Number(o.costoCorte))}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
