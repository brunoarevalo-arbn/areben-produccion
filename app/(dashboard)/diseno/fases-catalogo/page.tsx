import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { FaseCatalogoManager } from '@/components/diseno/FaseCatalogoManager';

export const dynamic = 'force-dynamic';

export default async function FasesCatalogoPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect('/login');
  if (session.rol === 'costurera') redirect('/tiempos');

  if (session.rol !== 'admin') {
    const user = await prisma.usuario.findUnique({ where: { id: session.id }, select: { permisos: true } });
    if (user?.permisos.includes('diseno')) redirect('/dashboard');
  }

  const fases = await prisma.faseCatalogo.findMany({ orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] });

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-violet-500">Diseño</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Catálogo de fases</h1>
        <p className="text-stone-500 text-sm mt-1">
          Etapas que pueden registrarse para cada proyecto al pasar a producción.
        </p>
      </div>
      <FaseCatalogoManager inicial={fases.map((f) => ({ ...f, createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString() }))} />
    </div>
  );
}
