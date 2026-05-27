import Link from 'next/link';
import { InsumosClient } from '@/components/insumos/InsumosClient';

export const dynamic = 'force-dynamic';

const ACCESOS = [
  { label: 'Compras',      desc: 'Historial de compras a proveedores.',                 href: '/insumos/compras' },
  { label: 'Rollos',       desc: 'Vista plana de todos los rollos con estado y peso.',   href: '/insumos/rollos' },
  { label: 'Lotes',        desc: 'Etiquetas, badanas, hilos y otros por lote.',          href: '/insumos/lotes' },
  { label: 'Movimientos',  desc: 'Auditoria completa de ingresos, consumos y ajustes.', href: '/insumos/movimientos' },
  { label: 'Ajustes',      desc: 'Cargar ajustes fisicos (descarte, correccion).',       href: '/insumos/ajustes' },
];

export default function InsumosPage() {
  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Insumos</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Stock de Insumos</h1>
        <p className="text-stone-500 text-sm mt-1">Visibilidad y valorizacion del capital en insumos productivos.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-10">
        {ACCESOS.map((a) => (
          <Link key={a.href} href={a.href}
            className="block rounded-2xl border-2 border-stone-200 hover:border-stone-400 p-4 transition bg-white">
            <h2 className="font-bold text-stone-800 text-sm">{a.label}</h2>
            <p className="text-stone-500 text-xs mt-1">{a.desc}</p>
          </Link>
        ))}
      </div>

      <InsumosClient />
    </div>
  );
}
