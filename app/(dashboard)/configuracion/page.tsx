import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

const ACCESOS = [
  { label: 'Usuarios',            desc: 'Altas, permisos y acceso al sistema.',            href: '/configuracion/usuarios',          permiso: 'usuarios' },
  { label: 'Cortadores',          desc: 'Cortadores y su usuario de panel.',                href: '/configuracion/cortadores',        permiso: 'cortadores' },
  { label: 'Proveedores',         desc: 'Proveedores de telas, avíos y servicios.',         href: '/configuracion/proveedores',       permiso: 'proveedores' },
  { label: 'Motivos de descarte', desc: 'Motivos para descartar prendas en producción.',    href: '/configuracion/motivos-descarte',  permiso: 'motivos' },
];

export default async function ConfiguracionPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect('/login');

  const esAdmin = session.rol === 'admin';
  const permisos = esAdmin ? null : (await prisma.usuario.findUnique({ where: { id: session.id }, select: { permisos: true } }))?.permisos ?? [];
  const visibles = ACCESOS.filter((a) => esAdmin || permisos!.includes(a.permiso));

  // Si solo tiene acceso a uno, va directo (evita un hub de un solo ítem).
  if (visibles.length === 1) redirect(visibles[0].href);

  return (
    <div className="p-8 max-w-5xl">
      <PageHeader eyebrow="Configuración" title="Configuración" subtitle="Ajustes del sistema y catálogos de referencia." />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {visibles.map((a) => (
          <Link key={a.href} href={a.href}
            className="block rounded-2xl border-2 border-stone-200 hover:border-stone-400 p-4 transition bg-white">
            <h2 className="font-bold text-stone-800 text-sm">{a.label}</h2>
            <p className="text-stone-500 text-xs mt-1">{a.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
