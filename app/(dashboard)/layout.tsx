import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySession } from '@/lib/session';
import { getPermisos } from '@/lib/auth';
import { Sidebar } from '@/components/layout/Sidebar';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect('/login');

  // Allowlist de secciones que el usuario tiene otorgadas (admin = todas).
  const permisos = await getPermisos(session);

  return (
    <div className="flex h-screen bg-stone-100 overflow-hidden">
      <Sidebar permisos={permisos} nombre={session.nombre} rol={session.rol} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
