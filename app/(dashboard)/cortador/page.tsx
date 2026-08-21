import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { SkuChip } from '@/components/ui/SkuChip';
import { MuestrasCortador } from '@/components/produccion/cortador/MuestrasCortador';
import { EliminarCorteBtn } from '@/components/produccion/cortador/EliminarCorteBtn';
import { cuentaDe, esCorteCobrable } from '@/lib/produccion/cuenta-cortador';

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
    select: { id: true, sku: true, descripcion: true, marca: true, cantidad: true, fichaCorteCargada: true, corteEstado: true, costoCorte: true, fechaCorte: true, pagoCorteId: true },
  });

  const muestras = await prisma.corteMuestra.findMany({ where: { cortadorId: cortador.id }, orderBy: { fecha: 'desc' } });
  const muestrasVista = muestras.map((m) => ({ id: m.id, descripcion: m.descripcion, consumo: Number(m.consumo), unidad: m.unidad, valor: Number(m.valor), estado: m.estado, fecha: m.fecha.toISOString() }));

  const esValidado = (o: (typeof ordenes)[number]) => o.corteEstado === 'validado';
  const porCargar  = ordenes.filter((o) => !o.fichaCorteCargada && o.corteEstado !== 'cargado' && !esValidado(o));
  const cargados   = ordenes.filter((o) => !o.fichaCorteCargada && o.corteEstado === 'cargado');
  // Cobrable = lo que entra a la cuenta corriente. El predicado es el del núcleo, no una
  // copia: si el `select` de arriba deja de traer un campo, esto no compila.
  const historicos = ordenes
    .filter((o) => esCorteCobrable(o) || o.fichaCorteCargada)
    .sort((a, b) => (b.fechaCorte?.getTime() ?? 0) - (a.fechaCorte?.getTime() ?? 0)); // más reciente primero, por fecha de corte
  const totalUnidHist = historicos.reduce((s, o) => s + o.cantidad, 0);
  const totalCobrado  = historicos.reduce((s, o) => s + Number(o.costoCorte), 0);

  // Resumen accionable de arriba: unidades por cortar y saldo de la cuenta corriente.
  // El saldo sale del MISMO núcleo que Cuenta de cortadores — es el único número, y tiene
  // que coincidir con el de esa pantalla al peso.
  const unidadesPendientes = porCargar.reduce((s, o) => s + o.cantidad, 0);
  const cuenta = await cuentaDe(cortador.id);
  const pendienteCobro = cuenta.saldo;

  type Orden = (typeof ordenes)[number];
  const filaPendiente = (o: Orden, cargado: boolean) => (
    <div key={o.id} className="flex items-center gap-3 px-5 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <SkuChip sku={o.sku ?? 'S/SKU'} className="text-stone-700" />
          <span className="text-xs text-stone-400">{o.marca}</span>
          {cargado && <span className="text-xs font-semibold text-blue-600">✓ confirmado (esperando al taller)</span>}
        </div>
        {o.descripcion && <p className="text-sm text-stone-600 mt-1 truncate">{o.descripcion}</p>}
      </div>
      <span className="text-xs text-stone-400 tabular-nums shrink-0">{o.cantidad} u</span>
      {cargado && <EliminarCorteBtn ordenId={o.id} sku={o.sku ?? 'S/SKU'} />}
      <Link href={`/cortador/${o.id}`} className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold transition">
        {cargado ? 'Editar' : 'Cargar corte'}
      </Link>
    </div>
  );

  return (
    <div className="p-8 max-w-3xl space-y-8">
      <PageHeader eyebrow="Cortador" title={`Hola, ${cortador.nombre}`} subtitle="Cargá tus cortes: tizadas, talles y precio. El taller asigna la tela." />

      {/* Resumen accionable */}
      <div className="grid grid-cols-3 gap-3">
        <Card padding="none" className="p-4">
          <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Por cortar</p>
          <p className="text-2xl font-bold text-stone-800 tabular-nums">{porCargar.length}</p>
          <p className="text-xs text-stone-400">{unidadesPendientes} u por cortar</p>
        </Card>
        <Card padding="none" className="p-4">
          <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Esperando taller</p>
          <p className="text-2xl font-bold text-stone-800 tabular-nums">{cargados.length}</p>
          <p className="text-xs text-stone-400">cargados, a validar</p>
        </Card>
        {pendienteCobro < 0 ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs text-emerald-700 uppercase tracking-widest font-bold">Cobrado de más</p>
            <p className="text-2xl font-bold text-emerald-700 tabular-nums">{fmt$(-pendienteCobro)}</p>
            <p className="text-xs text-emerald-600/80">te pagaron de más: queda a cuenta de próximos cortes</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs text-amber-700 uppercase tracking-widest font-bold">Pendiente de cobro</p>
            <p className="text-2xl font-bold text-amber-700 tabular-nums">{fmt$(pendienteCobro)}</p>
            <p className="text-xs text-amber-600/80">todo lo cortado menos todo lo cobrado</p>
          </div>
        )}
      </div>

      {/* Pendientes por cargar */}
      <section>
        <h2 className="text-sm font-bold text-stone-800 mb-3">Por cargar {porCargar.length > 0 && <span className="text-amber-600">({porCargar.length})</span>}</h2>
        {porCargar.length === 0 ? (
          <Card padding="none" className="p-6 text-center text-sm text-stone-400">No tenés cortes pendientes.</Card>
        ) : (
          <Card padding="none" className="divide-y divide-stone-100">
            {porCargar.map((o) => filaPendiente(o, false))}
          </Card>
        )}
      </section>

      {/* Cargados, esperando al taller */}
      <section>
        <h2 className="text-sm font-bold text-stone-800 mb-3">Cortes cargados {cargados.length > 0 && <span className="text-blue-600">({cargados.length})</span>}</h2>
        {cargados.length === 0 ? (
          <Card padding="none" className="p-6 text-center text-sm text-stone-400">No tenés cortes esperando al taller.</Card>
        ) : (
          <Card padding="none" className="divide-y divide-stone-100">
            {cargados.map((o) => filaPendiente(o, true))}
          </Card>
        )}
      </section>

      {/* Resumen + históricos */}
      <section>
        <h2 className="text-sm font-bold text-stone-800 mb-3">Historial de cortes</h2>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <Card padding="none" className="p-4"><p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Cortes</p><p className="text-lg font-bold text-stone-800">{historicos.length}</p></Card>
          <Card padding="none" className="p-4"><p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Unidades</p><p className="text-lg font-bold text-stone-800 tabular-nums">{totalUnidHist}</p></Card>
          <Card padding="none" className="p-4"><p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Total cortado</p><p className="text-lg font-bold text-stone-800 tabular-nums">{fmt$(totalCobrado)}</p></Card>
        </div>
        {historicos.length === 0 ? (
          <Card padding="none" className="p-6 text-center text-sm text-stone-400">Todavía no hay cortes procesados.</Card>
        ) : (
          <Card padding="none" className="divide-y divide-stone-100">
            {historicos.map((o) => (
              <div key={o.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <SkuChip sku={o.sku ?? 'S/SKU'} className="text-stone-700" />
                  {o.descripcion && <span className="text-sm text-stone-500 ml-2 truncate">{o.descripcion}</span>}
                </div>
                {o.fechaCorte && <span className="text-xs text-stone-400 shrink-0">{new Date(o.fechaCorte).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' })}</span>}
                <span className="text-xs text-stone-400 tabular-nums shrink-0">{o.cantidad} u</span>
                <span className="text-xs font-semibold text-stone-700 tabular-nums shrink-0 w-20 text-right">{fmt$(Number(o.costoCorte))}</span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <MuestrasCortador inicial={muestrasVista} />
    </div>
  );
}
