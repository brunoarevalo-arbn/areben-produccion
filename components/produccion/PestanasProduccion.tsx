'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Producción pasó de 8 ítems de menú a 4 (oct-2026): las pantallas siguen siendo las mismas,
// agrupadas con estas pestañas. El menú (Sidebar) marca el grupo con `incluye`.
export const PESTANAS = {
  cortadores: [
    { label: 'Cortes', href: '/produccion/cortadores' },
    { label: 'Cuenta', href: '/produccion/cuenta-cortadores' },
    { label: 'Pagos', href: '/produccion/pagos-cortes' },
    { label: 'Fichas de corte', href: '/produccion/fichas' },
  ],
  reportes: [
    { label: 'Diarios', href: '/produccion/reportes' },
    { label: 'Solicitudes de cambio', href: '/produccion/solicitudes-cambio' },
  ],
} as const;

export function PestanasProduccion({ grupo }: { grupo: keyof typeof PESTANAS }) {
  const pathname = usePathname();
  const activa = (href: string) => pathname === href || (pathname.startsWith(href + '/') && href !== '/produccion/reportes');
  return (
    <nav aria-label="Secciones" className="flex gap-1 border-b border-stone-200 mb-6 overflow-x-auto print:hidden">
      {PESTANAS[grupo].map((p) => (
        <Link key={p.href} href={p.href} aria-current={activa(p.href) ? 'page' : undefined}
          className={`h-10 px-3 -mb-px inline-flex items-center whitespace-nowrap border-b-2 text-[13.5px] font-semibold transition-colors ${
            activa(p.href) ? 'border-amber-400 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}>{p.label}</Link>
      ))}
    </nav>
  );
}
