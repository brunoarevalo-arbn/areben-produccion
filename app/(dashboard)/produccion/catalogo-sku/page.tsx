import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { CatalogoSkuManager } from '@/components/produccion/CatalogoSkuManager';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default async function CatalogoSkuPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect('/login');
  if (session.rol === 'costurera') redirect('/tiempos');

  if (session.rol !== 'admin') {
    const user = await prisma.usuario.findUnique({ where: { id: session.id }, select: { permisos: true } });
    if (!user?.permisos.includes('produccion')) redirect('/dashboard');
  }

  const entries = await prisma.skuCatalogo.findMany({
    orderBy: [{ categoria: 'asc' }, { orden: 'asc' }, { nombre: 'asc' }],
  });

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader
        eyebrow="Producción"
        title="Catálogo de SKUs"
        subtitle="Opciones disponibles para armar el SKU al cargar una orden de producción."
      />
      <CatalogoSkuManager inicial={entries.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }))} />
    </div>
  );
}
