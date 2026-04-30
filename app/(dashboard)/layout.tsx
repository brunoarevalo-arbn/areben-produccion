import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { Sidebar } from '@/components/layout/Sidebar';

export const ALL_PERMISOS = ['dashboard', 'diseno', 'produccion', 'gastos', 'costos', 'configuracion'];

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect('/login');

  let permisos: string[];
  if (session.rol === 'admin') {
    permisos = ALL_PERMISOS;
  } else {
    const user = await prisma.usuario.findUnique({
      where: { id: session.id },
      select: { permisos: true },
    });
    permisos = user?.permisos ?? [];
  }

  return (
    <div className="flex h-screen bg-stone-100 overflow-hidden">
      <Sidebar permisos={permisos} nombre={session.nombre} rol={session.rol} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
