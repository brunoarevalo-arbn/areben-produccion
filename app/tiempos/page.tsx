import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { TiemposClient } from '@/components/tiempos/TiemposClient';

export const dynamic = 'force-dynamic';

export default async function TiemposPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) redirect('/login');

  const session = await verifySession(token);
  if (!session) redirect('/login');

  const ordenes = await prisma.ordenProduccion.findMany({
    // La tablet de costura solo muestra órdenes en costura.
    where: { estado: 'COSTURA' },
    orderBy: [{ createdAt: 'asc' }],
    select: { id: true, sku: true, descripcion: true, marca: true, cantidad: true, estado: true },
  });

  return (
    <TiemposClient
      usuario={{ id: session.id, nombre: session.nombre, username: session.username, rol: session.rol }}
      ordenesIniciales={ordenes}
    />
  );
}
