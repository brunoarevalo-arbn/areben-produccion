import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { TiemposClient } from '@/components/tiempos/TiemposClient';
import { colaTablet } from '@/lib/produccion/colaTablet';

export const dynamic = 'force-dynamic';

export default async function TiemposPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) redirect('/login');

  const session = await verifySession(token);
  if (!session) redirect('/login');

  // `ordenes` es para los registros del día (todas las de costura); la COLA que se elige
  // es la misma que la API devuelve cada 30 s, o el primer dibujo muestra otra lista.
  const [ordenes, cola] = await Promise.all([
    prisma.ordenProduccion.findMany({
      where: { estado: 'COSTURA' },
      orderBy: [{ createdAt: 'asc' }],
      select: { id: true, sku: true, descripcion: true, marca: true, cantidad: true, estado: true },
    }),
    colaTablet(),
  ]);

  return (
    <TiemposClient
      usuario={{ id: session.id, nombre: session.nombre, username: session.username, rol: session.rol }}
      ordenesIniciales={ordenes}
      colaInicial={cola}
    />
  );
}
