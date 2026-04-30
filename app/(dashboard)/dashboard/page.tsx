import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ESTADO_DISENO_LABEL: Record<string, string> = {
  inspiracion:   'Inspiración',
  en_desarrollo: 'En desarrollo',
  muestra_lista: 'Muestra lista',
  ajustes:       'Ajustes',
  produccion:    'Producción',
  descontinuado: 'Descontinuado',
};

const ESTADO_DISENO_COLOR: Record<string, string> = {
  inspiracion:   'bg-violet-100 text-violet-700',
  en_desarrollo: 'bg-amber-100 text-amber-700',
  muestra_lista: 'bg-sky-100 text-sky-700',
  ajustes:       'bg-orange-100 text-orange-700',
  produccion:    'bg-emerald-100 text-emerald-700',
  descontinuado: 'bg-stone-100 text-stone-400',
};

const ACCESOS = [
  { label: '+ Nuevo proyecto',   href: '/diseno/nuevo' },
  { label: '+ Escandallo',       href: '/costos' },
  { label: 'Registrar tiempos',  href: '/tiempos' },
  { label: 'Reportes',           href: '/produccion/reportes' },
  { label: 'Molderías',          href: '/configuracion/molderias' },
  { label: 'Telas',              href: '/configuracion/telas' },
];

const MARCAS = ['Zattia', 'Stunned'] as const;

function diasRestantes(fecha: Date): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const target = new Date(fecha);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function formatFecha(fecha: Date): string {
  return fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function DashboardPage() {
  const hoy = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const proyectos = await prisma.proyectoDiseno.findMany({
    where: { estado: { not: 'archivado' } },
    select: {
      id:            true,
      nombre:        true,
      marca:         true,
      estado:        true,
      estadoDiseno:  true,
      fechaObjetivo: true,
      pasos:         { select: { estado: true, saltado: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Agrupar por marca
  const porMarca = MARCAS.map((marca) => {
    const pms = proyectos.filter((p) => p.marca === marca);
    const porEstado = pms.reduce<Record<string, number>>((acc, p) => {
      acc[p.estadoDiseno] = (acc[p.estadoDiseno] ?? 0) + 1;
      return acc;
    }, {});
    return { marca, total: pms.length, porEstado };
  });

  // Proyectos con fecha objetivo, ordenados por fecha
  const conFecha = proyectos
    .filter((p) => p.fechaObjetivo)
    .sort((a, b) => new Date(a.fechaObjetivo!).getTime() - new Date(b.fechaObjetivo!).getTime());

  return (
    <div className="p-8 max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <p className="text-stone-400 text-sm capitalize">{hoy}</p>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Dashboard</h1>
      </div>

      {/* Accesos directos */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Accesos rápidos</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {ACCESOS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-stone-700 hover:border-stone-400 hover:text-stone-900 transition text-center"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Proyectos por marca */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Proyectos activos</p>
        <div className="grid grid-cols-2 gap-5">
          {porMarca.map(({ marca, total, porEstado }) => (
            <div key={marca} className="bg-white rounded-2xl border border-stone-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-stone-900">{marca}</h2>
                <span className="text-2xl font-black text-stone-200">{total}</span>
              </div>
              {total === 0 ? (
                <p className="text-xs text-stone-400 italic">Sin proyectos activos</p>
              ) : (
                <div className="space-y-1.5">
                  {Object.entries(porEstado)
                    .sort((a, b) => b[1] - a[1])
                    .map(([estado, cant]) => (
                      <div key={estado} className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_DISENO_COLOR[estado] ?? 'bg-stone-100 text-stone-500'}`}>
                          {ESTADO_DISENO_LABEL[estado] ?? estado}
                        </span>
                        <span className="text-xs font-bold text-stone-500 tabular-nums">{cant}</span>
                      </div>
                    ))}
                </div>
              )}
              <Link
                href="/diseno"
                className="mt-4 block text-center text-xs text-stone-400 hover:text-stone-700 transition pt-3 border-t border-stone-100"
              >
                Ver todos →
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Fechas objetivo */}
      {conFecha.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Fechas objetivo</p>
          <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
            {conFecha.map((p) => {
              const dias = diasRestantes(p.fechaObjetivo!);
              const vencido = dias < 0;
              const urgente = dias >= 0 && dias <= 7;
              return (
                <Link
                  key={p.id}
                  href={`/diseno/${p.id}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-stone-50 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-stone-800 truncate">{p.nombre}</span>
                      <span className="text-xs text-stone-400">{p.marca}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_DISENO_COLOR[p.estadoDiseno] ?? 'bg-stone-100 text-stone-500'}`}>
                        {ESTADO_DISENO_LABEL[p.estadoDiseno] ?? p.estadoDiseno}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">{formatFecha(p.fechaObjetivo!)}</p>
                  </div>
                  <div className={`text-right shrink-0 text-xs font-bold tabular-nums ${
                    vencido ? 'text-red-600' : urgente ? 'text-amber-600' : 'text-stone-500'
                  }`}>
                    {vencido
                      ? `${Math.abs(dias)}d vencido`
                      : dias === 0
                      ? 'Hoy'
                      : `${dias}d`}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
