import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

export default async function CortadoresAdminHubPage() {
  const [cortadores, ordenes] = await Promise.all([
    prisma.cortador.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
    prisma.ordenProduccion.findMany({
      where: { cortadorId: { not: null } },
      select: { cortadorId: true, fichaCorteCargada: true, corteEstado: true },
    }),
  ]);

  const stats = new Map<string, { asignados: number; listos: number; hechos: number }>();
  for (const c of cortadores) stats.set(c.id, { asignados: 0, listos: 0, hechos: 0 });
  for (const o of ordenes) {
    const s = o.cortadorId ? stats.get(o.cortadorId) : null;
    if (!s) continue;
    if (o.fichaCorteCargada || o.corteEstado === 'validado') s.hechos++;
    else if (o.corteEstado === 'cargado') s.listos++;
    else s.asignados++;
  }

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <PageHeader eyebrow="Producción" title="Cortes por cortador" subtitle="Qué tiene asignado cada cortador y qué está listo para validar." />
      {cortadores.length === 0 ? (
        <EmptyState title="No hay cortadores activos" message="Dá de alta cortadores en Configuración → Cortadores." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cortadores.map((c) => {
            const s = stats.get(c.id)!;
            return (
              <Link key={c.id} href={`/produccion/cortadores/${c.id}`}>
                <Card padding="none" className="p-5 hover:border-amber-300 transition">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-bold text-stone-800">{c.nombre}</p>
                    {s.listos > 0 && <Badge variant="success" size="sm">{s.listos} listo{s.listos > 1 ? 's' : ''}</Badge>}
                  </div>
                  <div className="flex gap-4 text-xs text-stone-500">
                    <span>Asignados <strong className="text-stone-700 tabular-nums">{s.asignados}</strong></span>
                    <span>A validar <strong className="text-stone-700 tabular-nums">{s.listos}</strong></span>
                    <span>Hechos <strong className="text-stone-700 tabular-nums">{s.hechos}</strong></span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
