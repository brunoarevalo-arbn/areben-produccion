'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: '⊞',
    sub: [],
  },
  {
    label: 'Diseño',
    href: '/diseno',
    icon: '📐',
    sub: [
      { label: 'Proyectos', href: '/diseno' },
      { label: 'Nuevo',     href: '/diseno/nuevo' },
    ],
  },
  {
    label: 'Producción',
    href: '/produccion',
    icon: '⏱',
    sub: [
      { label: 'Tiempos',  href: '/tiempos' },
      { label: 'Reportes', href: '/produccion/reportes' },
    ],
  },
  {
    label: 'Configuración',
    href: '/configuracion',
    icon: '⚙',
    sub: [
      { label: 'Usuarios', href: '/configuracion/usuarios' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

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
        <p className="text-stone-300 text-xs mt-0.5">Sistema de gestión</p>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
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
                    <Link
                      key={s.href}
                      href={s.href}
                      className={`block px-3 py-1.5 rounded-lg text-xs transition-colors ${
                        pathname === s.href
                          ? 'text-amber-400 font-semibold'
                          : 'text-stone-500 hover:text-stone-300'
                      }`}
                    >
                      {s.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-5 py-3 border-t border-stone-800">
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
