import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySession } from '@/lib/session';
import { getPermisos } from '@/lib/auth';
import type { PermisoKey } from '@/lib/permisos';

// Guard server-side a nivel página/sección. Usar en el layout.tsx de cada
// sección (o en la página). Redirige a /login si no hay sesión, o a
// /sin-acceso si la sesión no tiene el permiso de la sección.
export async function requirePagina(seccion: PermisoKey) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect('/login');

  const permisos = await getPermisos(session);
  if (!permisos.includes(seccion)) redirect('/sin-acceso');

  return session;
}
