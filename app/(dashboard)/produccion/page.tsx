import Link from 'next/link';
import { ColaAdmin } from '@/components/produccion/ColaAdmin';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

const ACCESOS = [
  {
    label: 'Fichas de corte',
    desc: 'Fichas pendientes de cargar y todos los SKU en producción.',
    href: '/produccion/fichas',
    icon: '📋',
    color: 'bg-amber-50 border-amber-300 hover:border-amber-400',
  },
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
  {
    label: 'Costos por SKU',
    desc: 'Minutos totales y desglose por máquina de cada corte terminado.',
    href: '/produccion/reportes/sku',
    icon: '📦',
    color: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
  },
  {
    label: 'Catálogo de SKU',
    desc: 'Marcas, prendas y colores con sus abreviaturas para generar SKUs.',
    href: '/produccion/catalogo-sku',
    icon: '🏷',
    color: 'bg-violet-50 border-violet-200 hover:border-violet-400',
  },
  {
    label: 'Pagos de cortes',
    desc: 'Registrar pagos masivos a cortadores. Pendientes y pagados.',
    href: '/produccion/pagos-cortes',
    icon: '💵',
    color: 'bg-blue-50 border-blue-200 hover:border-blue-400',
  },
];

export default function ProduccionPage() {
  return (
    <div className="p-8 max-w-4xl">
      <PageHeader eyebrow="Módulo 2" title="Control de Producción" subtitle="Cola de trabajo, tiempos y reportes del taller." />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
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

      <div>
        <h2 className="text-lg font-bold text-stone-900 mb-1">Cola de producción</h2>
        <p className="text-stone-500 text-sm mb-5">
          Agregá órdenes por SKU. Las costureras las ven en tiempo real y marcan cuando terminan.
        </p>
        <ColaAdmin />
      </div>
    </div>
  );
}
