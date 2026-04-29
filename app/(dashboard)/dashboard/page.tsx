import Link from 'next/link';

const MODULOS = [
  {
    titulo: 'Diseño de Indumentaria',
    descripcion: 'Proyectos de diseño con flujo completo de 18 pasos: materia prima, moldería, muestras y producción.',
    href: '/diseno',
    icon: '📐',
    accent: 'border-violet-400',
    badge: 'Módulo 1',
    badgeColor: 'bg-violet-100 text-violet-700',
    links: [
      { label: 'Proyectos',      href: '/diseno' },
      { label: 'Nuevo proyecto', href: '/diseno/nuevo' },
    ],
  },
  {
    titulo: 'Control de Producción',
    descripcion: 'Tiempos por costurera, máquina y actividad. Reportes diarios del taller.',
    href: '/produccion',
    icon: '⏱',
    accent: 'border-amber-400',
    badge: 'Módulo 2',
    badgeColor: 'bg-amber-100 text-amber-700',
    links: [
      { label: 'Registrar tiempos', href: '/tiempos' },
      { label: 'Reportes diarios',  href: '/produccion/reportes' },
    ],
  },
];

export default function DashboardPage() {
  const hoy = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <p className="text-stone-400 text-sm capitalize">{hoy}</p>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Dashboard</h1>
        <p className="text-stone-500 text-sm mt-1">App de diseño y producción — Areben</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {MODULOS.map((mod) => (
          <div key={mod.href} className={`bg-white rounded-2xl border-l-4 ${mod.accent} shadow-sm p-5 flex flex-col gap-4`}>
            <div className="flex items-start justify-between">
              <span className="text-3xl">{mod.icon}</span>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${mod.badgeColor}`}>
                {mod.badge}
              </span>
            </div>

            <div>
              <h2 className="text-base font-bold text-stone-900">{mod.titulo}</h2>
              <p className="text-stone-500 text-xs mt-1">{mod.descripcion}</p>
            </div>

            <div className="space-y-1 border-t border-stone-100 pt-3">
              {mod.links.map((l) => (
                <Link key={l.href} href={l.href}
                  className="flex items-center justify-between text-xs text-stone-600 hover:text-stone-900 py-0.5 group">
                  <span>{l.label}</span>
                  <span className="text-stone-300 group-hover:text-stone-500">›</span>
                </Link>
              ))}
            </div>

            <Link href={mod.href}
              className="mt-auto block text-center bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold py-2.5 rounded-xl transition uppercase tracking-wide">
              Abrir →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
