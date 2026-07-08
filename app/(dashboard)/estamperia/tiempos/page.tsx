import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });

export default async function TiemposEstampadoPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect('/login');
  const esAdmin = session.rol === 'admin';
  if (!esAdmin) {
    const u = await prisma.usuario.findUnique({ where: { id: session.id }, select: { permisos: true } });
    if (!u?.permisos.includes('estamperia')) redirect('/dashboard');
  }

  const tandas = await prisma.tiemposEstampado.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });

  const totalEst = tandas.reduce((s, t) => s + t.cantidad, 0);
  const totalMin = tandas.reduce((s, t) => s + t.minutosNetos, 0);
  const minPorEstampa = totalEst > 0 ? totalMin / totalEst : 0;

  // Por estampador
  const porUsuario = new Map<string, { estampas: number; minutos: number }>();
  for (const t of tandas) {
    const u = porUsuario.get(t.usuario) ?? { estampas: 0, minutos: 0 };
    u.estampas += t.cantidad; u.minutos += t.minutosNetos;
    porUsuario.set(t.usuario, u);
  }

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/estamperia" className="text-sm text-stone-500 hover:text-stone-800 transition">← Estampería</Link>
      <PageHeader eyebrow="Estampería" title="Tiempos de estampado" subtitle="Estudio de tiempos por tanda. El estándar es el promedio min/estampa." />

      {/* Estándar global */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card padding="none" className="p-4"><p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Estampas</p><p className="text-2xl font-bold text-stone-800 tabular-nums">{totalEst}</p></Card>
        <Card padding="none" className="p-4"><p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Minutos</p><p className="text-2xl font-bold text-stone-800 tabular-nums">{fmt(totalMin)}</p></Card>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs text-amber-700 uppercase tracking-widest font-bold">Min por estampa</p><p className="text-2xl font-bold text-amber-700 tabular-nums">{fmt(minPorEstampa)}</p></div>
      </div>

      {/* Por estampador */}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-stone-800 mb-3">Por estampador</h2>
        {porUsuario.size === 0 ? (
          <EmptyState title="Sin tandas registradas" message="El estampador carga las tandas desde su tablet (/estampado)." />
        ) : (
          <Card padding="none" className="divide-y divide-stone-100">
            {[...porUsuario.entries()].map(([u, v]) => (
              <div key={u} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="font-semibold text-stone-800 flex-1">{u}</span>
                <span className="text-stone-400 tabular-nums">{v.estampas} est.</span>
                <span className="text-stone-400 tabular-nums">{fmt(v.minutos)} min</span>
                <span className="font-semibold text-amber-700 tabular-nums w-24 text-right">{fmt(v.estampas > 0 ? v.minutos / v.estampas : 0)} min/est</span>
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* Tandas recientes */}
      {tandas.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-stone-800 mb-3">Tandas recientes</h2>
          <Card padding="none" className="divide-y divide-stone-100">
            {tandas.slice(0, 50).map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className="text-xs text-stone-400 w-20">{t.fecha}</span>
                <span className="text-stone-500 flex-1 truncate">{t.usuario}{t.notas ? ` · ${t.notas}` : ''}</span>
                <span className="font-semibold text-stone-700 tabular-nums">{t.cantidad} est.</span>
                <span className="text-stone-400 tabular-nums w-16 text-right">{fmt(t.minutosNetos)} min</span>
                <span className="text-amber-700 tabular-nums w-20 text-right">{fmt(t.cantidad > 0 ? t.minutosNetos / t.cantidad : 0)}/est</span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
