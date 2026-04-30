import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { GastosClient } from '@/components/gastos/GastosClient';

export const dynamic = 'force-dynamic';

export default async function GastosPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect('/login');

  if (session.rol !== 'admin') {
    const user = await prisma.usuario.findUnique({ where: { id: session.id }, select: { permisos: true } });
    if (!user?.permisos.includes('gastos')) redirect('/dashboard');
  }

  const [gastosDesarrollo, gastosProduccion, ordenes] = await Promise.all([
    prisma.gasto.findMany({ where: { categoria: 'desarrollo' }, orderBy: { createdAt: 'desc' } }),
    prisma.gasto.findMany({ where: { categoria: 'produccion' }, orderBy: { createdAt: 'desc' } }),
    prisma.ordenProduccion.findMany({
      where: { estado: { in: ['pendiente', 'en_produccion'] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, sku: true, descripcion: true, marca: true },
    }),
  ]);

  return (
    <div className="p-8">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Gastos</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Gastos del taller</h1>
        <p className="text-stone-500 text-sm mt-1">Desarrollo y producción.</p>
      </div>

      <GastosClient
        gastosDesarrollo={gastosDesarrollo.map((g) => ({ ...g, createdAt: g.createdAt.toISOString() }))}
        gastosProduccion={gastosProduccion.map((g) => ({ ...g, createdAt: g.createdAt.toISOString() }))}
        ordenes={ordenes}
      />
    </div>
  );
}
