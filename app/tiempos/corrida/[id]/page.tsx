import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { cargarCorrida, serializar } from '@/lib/calculadora/corridaDb';
import { CorridaTablet } from '@/components/tiempos/CorridaTablet';

export const dynamic = 'force-dynamic';

// Vive bajo /tiempos a propósito: proxy.ts confina a la costurera a ese prefijo
// (`pathname.startsWith('/tiempos')`), así que la ruta entra sin tocar el proxy.
// El guard es manual, igual que en app/tiempos/page.tsx: acá no hay layout de
// (dashboard) ni requirePagina — la costurera tiene cero permisos por diseño.
export default async function CorridaTabletPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) redirect('/login');

  const session = await verifySession(token);
  if (!session) redirect('/login');

  const { id } = await params;
  const corrida = await cargarCorrida(id);
  if (!corrida) notFound();
  // Cada una ve la suya. El nombre sale de la sesión, nunca de la URL.
  if (corrida.costurera !== session.nombre && session.rol !== 'admin') redirect('/tiempos');

  return <CorridaTablet usuario={session.nombre} inicial={serializar(corrida)} />;
}
