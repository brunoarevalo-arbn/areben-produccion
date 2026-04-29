import Link from 'next/link';

const ACCESOS = [
  {
    label: 'Registrar Tiempos',
    desc: 'Cronómetro y formulario para costureras en el taller.',
    href: '/tiempos',
    icon: '⏱',
    color: 'bg-amber-50 border-amber-300 hover:border-amber-400',
  },
  {
    label: 'Reportes Diarios',
    desc: 'Resumen por costurera, máquina y actividad.',
    href: '/produccion/reportes',
    icon: '📊',
    color: 'bg-stone-50 border-stone-200 hover:border-stone-400',
  },
];

export default function ProduccionPage() {
  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Módulo 2</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Control de Producción</h1>
        <p className="text-stone-500 text-sm mt-1">Tiempos, reportes y métricas del taller.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ACCESOS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`block rounded-2xl border-2 p-6 transition ${a.color}`}
          >
            <div className="text-3xl mb-3">{a.icon}</div>
            <h2 className="font-bold text-stone-800 text-base">{a.label}</h2>
            <p className="text-stone-500 text-sm mt-1">{a.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
