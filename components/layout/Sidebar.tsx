'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface SidebarProps {
  permisos: string[];
  nombre:   string;
  rol:      string;
}

interface SubItem { label: string; href: string; nuevoHref?: string; }

const NAV: { label: string; href: string; icon: string; seccion: string; sub: SubItem[] }[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: '⊞',
    seccion: 'dashboard',
    sub: [],
  },
  {
    label: 'Diseño',
    href: '/diseno',
    icon: '📐',
    seccion: 'diseno',
    sub: [
      { label: 'Proyectos', href: '/diseno', nuevoHref: '/diseno/nuevo' },
      { label: 'Molderías', href: '/diseno/molderias' },
      { label: 'Telas',     href: '/diseno/telas' },
    ],
  },
  {
    label: 'Producción',
    href: '/produccion',
    icon: '⏱',
    seccion: 'produccion',
    sub: [
      { label: 'Tiempos',  href: '/tiempos' },
      { label: 'Reportes', href: '/produccion/reportes' },
    ],
  },
  {
    label: 'Gastos',
    href: '/gastos',
    icon: '🧾',
    seccion: 'gastos',
    sub: [],
  },
  {
    label: 'Costos',
    href: '/costos',
    icon: '💰',
    seccion: 'costos',
    sub: [
      { label: 'Escandallos', href: '/costos' },
    ],
  },
  {
    label: 'Configuración',
    href: '/configuracion',
    icon: '⚙',
    seccion: 'configuracion',
    sub: [
      { label: 'Usuarios', href: '/configuracion/usuarios' },
    ],
  },
];

export function Sidebar({ permisos, nombre, rol }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();

  const visible = NAV.filter((item) => permisos.includes(item.seccion));

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <aside className="w-56 bg-stone-900 flex flex-col h-full shrink-0">
      <div className="px-5 py-4 border-b border-stone-800">
        <p className="text-amber-400 text-xs font-bold uppercase tracking-widest">Areben</p>
        <p className="text-stone-300 text-xs mt-0.5 truncate">{nombre}</p>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {visible.map((item) => {
          const active = isActive(item.href);
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-stone-800 text-amber-400'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
                }`}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>

              {item.sub.length > 0 && active && (
                <div className="ml-9 mt-0.5 mb-1 space-y-0.5">
                  {item.sub.map((s) => (
                    <div key={s.href} className="flex items-center gap-1">
                      <Link
                        href={s.href}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                          pathname === s.href
                            ? 'text-amber-400 font-semibold'
                            : 'text-stone-500 hover:text-stone-300'
                        }`}
                      >
                        {s.label}
                      </Link>
                      {s.nuevoHref && (
                        <Link
                          href={s.nuevoHref}
                          title="Nuevo"
                          className="px-1.5 py-1 rounded-md text-stone-600 hover:text-stone-300 hover:bg-stone-800 transition text-sm leading-none"
                        >
                          +
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-5 py-3 border-t border-stone-800 space-y-1">
        <p className="text-stone-600 text-xs truncate capitalize">{rol}</p>
        <button
          onClick={handleLogout}
          className="text-stone-600 hover:text-stone-400 text-xs transition w-full text-left"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
