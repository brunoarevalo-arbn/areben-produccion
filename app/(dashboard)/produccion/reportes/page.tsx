import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { ReportesClient } from '@/components/produccion/ReportesClient';

export const dynamic = 'force-dynamic';

export default async function ReportesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect('/login');

  return <ReportesClient isAdmin={session.rol === 'admin'} />;
}
