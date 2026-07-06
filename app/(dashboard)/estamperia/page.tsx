import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { EstamperiaClient } from '@/components/estamperia/EstamperiaClient';

export const dynamic = 'force-dynamic';

export default async function EstamperiaPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect('/login');
  const esAdmin = session.rol === 'admin';
  if (!esAdmin) {
    const u = await prisma.usuario.findUnique({ where: { id: session.id }, select: { permisos: true } });
    if (!u?.permisos.includes('estamperia')) redirect('/dashboard');
  }

  return (
    <div className="p-8 max-w-5xl">
      <PageHeader eyebrow="Estampería" title="Estampas DTF"
        subtitle="Cargá las estampas con su código; el nombre comercial y el producto se asignan cuando quieras (nada bloquea a nada)." />
      <EstamperiaClient esAdmin={esAdmin} />
    </div>
  );
}
