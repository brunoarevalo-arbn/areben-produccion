import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';

export const dynamic = 'force-dynamic';

const ACCESOS = [
  { label: '+ Nuevo proyecto',  href: '/diseno' },
  { label: '+ Escandallo',      href: '/costos' },
  { label: 'Registrar tiempos', href: '/tiempos' },
  { label: 'Reportes',          href: '/produccion/reportes' },
  { label: 'Molderías',         href: '/diseno/molderias' },
];

const MARCAS = ['Zattia', 'Stunned'] as const;

export default async function DashboardPage() {
  const hoy = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const [proyectos, costurerasCount] = await Promise.all([
    prisma.proyectoDiseno.findMany({
      where:   { archivado: false },
      select:  { id: true, nombre: true, marca: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.usuario.count({ where: { rol: 'costurera', activo: true } }),
  ]);

  const porMarca = MARCAS.map((marca) => ({
    marca,
    total: proyectos.filter((p) => p.marca === marca).length,
  }));

  return (
    <div className="p-8 max-w-4xl space-y-8">

      <PageHeader title="Inicio" subtitle={hoy.charAt(0).toUpperCase() + hoy.slice(1)} />

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Accesos rápidos</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {ACCESOS.map((a) => (
            <Link key={a.href} href={a.href}
              className="bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-stone-700 hover:border-stone-400 hover:text-stone-900 transition text-center">
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Proyectos activos</p>
        <div className="grid grid-cols-2 gap-5">
          {porMarca.map(({ marca, total }) => (
            <Link key={marca} href="/diseno"
              className="bg-white rounded-2xl border border-stone-200 hover:border-violet-300 p-5 transition">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold text-stone-900">{marca}</h2>
                <span className="text-2xl font-black text-stone-800 tabular-nums">{total}</span>
              </div>
              <p className="text-xs text-stone-400">{total === 1 ? '1 proyecto activo' : `${total} proyectos activos`}</p>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Equipo</p>
        <Card padding="none" className="p-5">
          <p className="text-sm text-stone-600">
            {costurerasCount} costurera{costurerasCount !== 1 ? 's' : ''} activa{costurerasCount !== 1 ? 's' : ''}
          </p>
        </Card>
      </div>
    </div>
  );
}
