import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { calcularCostoMinuto } from '@/lib/costoMinuto';
import { GastosClient } from '@/components/gastos/GastosClient';
import { PageHeader } from '@/components/ui/PageHeader';

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

  const [gastosDesarrollo, gastosProduccion, ordenes, costoMinuto] = await Promise.all([
    prisma.gasto.findMany({ where: { categoria: 'desarrollo' }, orderBy: { createdAt: 'desc' } }),
    prisma.gasto.findMany({ where: { categoria: 'produccion' }, orderBy: { createdAt: 'desc' } }),
    prisma.ordenProduccion.findMany({
      where: { estado: { not: 'CERRADA' } },   // órdenes activas (todas menos las cerradas)
      orderBy: { createdAt: 'asc' },
      select: { id: true, sku: true, descripcion: true, marca: true },
    }),
    calcularCostoMinuto(),
  ]);

  return (
    <div className="p-8">
      <PageHeader eyebrow="Gastos" title="Gastos del taller" subtitle="Desarrollo y producción." />

      <GastosClient
        gastosDesarrollo={gastosDesarrollo.map((g) => ({ ...g, createdAt: g.createdAt.toISOString() }))}
        gastosProduccion={gastosProduccion.map((g) => ({ ...g, createdAt: g.createdAt.toISOString() }))}
        ordenes={ordenes}
        costoMinuto={costoMinuto}
      />
    </div>
  );
}
