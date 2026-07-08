import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { EstampadoClient } from '@/components/estampado/EstampadoClient';

export const dynamic = 'force-dynamic';

export default async function EstampadoPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect('/login');

  return <EstampadoClient usuario={session.nombre} esEstampador={session.rol === 'estampador'} />;
}
