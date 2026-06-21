import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { CatalogoManager } from '@/components/configuracion/CatalogoManager';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default async function MolderiasPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect('/login');

  const items = await prisma.molderiaCatalogo.findMany({ orderBy: { nombre: 'asc' } });

  return (
    <div className="p-8">
      <PageHeader eyebrow="Diseño" title="Catálogo de Molderías" subtitle={`${items.length} moldería${items.length !== 1 ? 's' : ''} registrada${items.length !== 1 ? 's' : ''}`} />
      <CatalogoManager
        items={items.map((i) => ({ id: i.id, nombre: i.nombre }))}
        apiBase="/api/molderias"
        label="moldería"
        placeholder="Ej: Base recta, Base entallada..."
      />
    </div>
  );
}
