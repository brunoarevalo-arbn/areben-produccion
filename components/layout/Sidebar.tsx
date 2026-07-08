'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

interface SidebarProps {
  permisos: string[];
  nombre:   string;
  rol:      string;
}

interface SubItem { label: string; href: string; nuevoHref?: string; seccion?: string | string[]; }

// seccion puede ser una key o varias (OR) para módulos de unión (ej. Compras).
const tienePermiso = (permisos: string[], seccion?: string | string[]) =>
  seccion == null ? true : Array.isArray(seccion) ? seccion.some((s) => permisos.includes(s)) : permisos.includes(seccion);

const NAV: { label: string; href: string; icon: string; seccion: string | string[]; sub: SubItem[] }[] = [
  {
    label: 'Inicio',
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
    ],
  },
  {
    label: 'Inventario',
    href: '/inventario',
    icon: '📦',
    seccion: 'insumos',
    sub: [
      { label: 'Telas',              href: '/inventario' },
      { label: 'Avíos',              href: '/inventario/catalogo/avios' },
      { label: 'Rollos',             href: '/inventario/rollos' },
      { label: 'Movimientos',        href: '/inventario/movimientos' },
      { label: 'Ajustes',            href: '/inventario/ajustes' },
      { label: 'Producto terminado', href: '/inventario/terminado', seccion: 'produccion' },
      { label: 'Nuevo insumo',       href: '/inventario/catalogo', nuevoHref: '/inventario/catalogo/avios' },
    ],
  },
  {
    label: 'Compras',
    href: '/compras',
    icon: '🛒',
    seccion: ['insumos', 'gastos'],
    sub: [
      { label: 'Todas',            href: '/compras', nuevoHref: '/compras/nueva', seccion: ['insumos', 'gastos'] },
      { label: 'Cuentas por pagar', href: '/compras/cuentas-por-pagar', seccion: ['insumos', 'gastos'] },
    ],
  },
  {
    label: 'Producción',
    href: '/produccion',
    icon: '⏱',
    seccion: 'produccion',
    sub: [
      { label: 'Órdenes',          href: '/produccion', seccion: 'produccion' },
      { label: 'Fichas de corte',  href: '/produccion/fichas', seccion: 'produccion' },
      { label: 'Tiempos',          href: '/tiempos', seccion: 'produccion' },
      { label: 'Muestras',         href: '/produccion/muestras', seccion: 'produccion' },
      { label: 'Reportes',         href: '/produccion/reportes', seccion: 'produccion' },
      { label: 'Cortes por cortador', href: '/produccion/cortadores', seccion: 'produccion' },
      { label: 'Pagos de cortes', href: '/produccion/pagos-cortes', seccion: 'produccion' },
      { label: 'Cuenta de cortadores', href: '/produccion/cuenta-cortadores', seccion: 'produccion' },
    ],
  },
  {
    label: 'Estampería',
    href: '/estamperia',
    icon: '🖨',
    seccion: 'estamperia',
    sub: [
      { label: 'Catálogo',            href: '/estamperia', seccion: 'estamperia' },
      { label: 'Tiempos de estampado', href: '/estamperia/tiempos', seccion: 'estamperia' },
    ],
  },
  {
    label: 'Reposición',
    href: '/reposicion',
    icon: '🔁',
    seccion: 'reposicion',
    sub: [
      { label: 'Qué estampar',        href: '/reposicion' },
      { label: 'Órdenes de estampa',  href: '/reposicion/ordenes' },
      { label: 'Vincular productos',  href: '/reposicion/vincular' },
    ],
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
    label: 'Gastos',
    href: '/gastos',
    icon: '🧾',
    seccion: 'gastos',
    sub: [],
  },
  {
    label: 'Mis cortes',
    href: '/cortador',
    icon: '✂',
    seccion: 'cortador',
    sub: [],
  },
  {
    label: 'Configuración',
    href: '/configuracion',
    icon: '⚙',
    seccion: ['configuracion', 'usuarios', 'cortadores', 'motivos', 'proveedores'],
    sub: [
      { label: 'Usuarios',            href: '/configuracion/usuarios', seccion: 'usuarios' },
      { label: 'Cortadores',          href: '/configuracion/cortadores', seccion: 'cortadores' },
      { label: 'Proveedores',         href: '/configuracion/proveedores', seccion: 'proveedores' },
      { label: 'Motivos de descarte', href: '/configuracion/motivos-descarte', seccion: 'motivos' },
    ],
  },
];

export function Sidebar({ permisos, nombre }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const [open, setOpen] = useState(false);

  const visible = NAV.filter((item) => tienePermiso(permisos, item.seccion));

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  // Acordeón: qué secciones están desplegadas. La sección activa arranca (y se mantiene) abierta.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (href: string) => setExpanded((prev) => {
    const n = new Set(prev);
    n.has(href) ? n.delete(href) : n.add(href);
    return n;
  });
  useEffect(() => {
    const act = visible.find((i) => i.sub.length > 0 && isActive(i.href));
    if (act) setExpanded((prev) => prev.has(act.href) ? prev : new Set(prev).add(act.href));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const close = () => setOpen(false);

  // Contenido compartido por el sidebar fijo (desktop) y el drawer (mobile).
  const content = (
    <>
      <div className="px-6 py-5 border-b border-stone-800">
        <p className="text-amber-400 text-xs font-bold uppercase tracking-widest">Areben</p>
        <p className="text-stone-400 text-xs mt-2 truncate">{nombre}</p>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {visible.map((item) => {
          const active = isActive(item.href);
          const tieneSub = item.sub.length > 0;
          const abierto = expanded.has(item.href);
          const headerClass = `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
            active
              ? 'bg-amber-400/10 text-amber-400 border-amber-400/30'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 border-transparent'
          }`;
          return (
            <div key={item.href}>
              {tieneSub ? (
                <button
                  type="button"
                  onClick={() => toggle(item.href)}
                  aria-expanded={abierto}
                  className={`w-full text-left ${headerClass}`}
                >
                  <span className="text-lg w-5 text-center flex-shrink-0">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  <span className="text-xs text-stone-500 flex-shrink-0">{abierto ? '▾' : '▸'}</span>
                </button>
              ) : (
                <Link
                  href={item.href}
                  onClick={close}
                  aria-current={active ? 'page' : undefined}
                  className={headerClass}
                >
                  <span className="text-lg w-5 text-center flex-shrink-0">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                </Link>
              )}

              {tieneSub && abierto && (
                <div className="ml-4 mt-2 mb-2 pl-4 border-l border-stone-700 space-y-1">
                  {item.sub.filter((s) => tienePermiso(permisos, s.seccion ?? item.seccion)).map((s) => (
                    <div key={s.href} className="flex items-center gap-2 group">
                      <Link
                        href={s.href}
                        onClick={close}
                        aria-current={pathname === s.href ? 'page' : undefined}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          pathname === s.href
                            ? 'text-amber-400 bg-stone-800/60'
                            : 'text-stone-500 group-hover:text-stone-300'
                        }`}
                      >
                        {s.label}
                      </Link>
                      {s.nuevoHref && (
                        <Link
                          href={s.nuevoHref}
                          onClick={close}
                          title="Nuevo ítem"
                          className="px-2 py-1 rounded-md text-stone-600 hover:text-amber-400 hover:bg-stone-800 transition text-xs font-bold"
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

      <div className="px-6 py-4 border-t border-stone-800 space-y-3">
        <button
          onClick={handleLogout}
          className="w-full px-3 py-2 rounded-lg text-xs font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 transition text-left"
        >
          Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Topbar mobile (solo < md) */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-stone-900 flex items-center gap-3 px-4 print:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={open}
          className="text-stone-300 hover:text-white text-2xl leading-none p-1 -ml-1"
        >
          ☰
        </button>
        <p className="text-amber-400 text-sm font-bold uppercase tracking-widest">Areben</p>
      </header>

      {/* Overlay del drawer */}
      {open && (
        <div
          onClick={close}
          aria-hidden
          className="md:hidden fixed inset-0 z-40 bg-black/50 print:hidden"
        />
      )}

      {/* Drawer mobile */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-stone-900 flex flex-col transition-transform duration-200 print:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {content}
      </aside>

      {/* Sidebar fijo (md+) */}
      <aside className="hidden md:flex w-56 bg-stone-900 flex-col h-full shrink-0 print:hidden">
        {content}
      </aside>
    </>
  );
}
