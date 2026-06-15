import { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE, SessionPayload } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { PERMISO_KEYS, type PermisoKey } from '@/lib/permisos';

export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

// Permisos efectivos de una sesión (allowlist). Admin = todos; costurera = ninguno
// (su acceso es la tablet, ruteado por el middleware). El resto: lo que tenga otorgado.
export async function getPermisos(session: SessionPayload): Promise<string[]> {
  if (session.rol === 'admin') return [...PERMISO_KEYS];
  if (session.rol === 'costurera') return [];
  const user = await prisma.usuario.findUnique({ where: { id: session.id }, select: { permisos: true } });
  return user?.permisos ?? [];
}

// Helper puro para gatear UI/lógica una vez que ya tenés los permisos resueltos.
export function can(permisos: string[], permiso: PermisoKey): boolean {
  return permisos.includes(permiso);
}

export async function requireAdmin(req: NextRequest): Promise<SessionPayload | null> {
  const session = await getSession(req);
  if (!session) return null;
  if (session.rol === 'admin') return session;
  return null;
}

// Guard central de APIs: exige que la sesión tenga el permiso. Admin pasa siempre.
// Bajada de línea: toda API nueva se gatea con esto, no con chequeos de rol sueltos.
export async function requirePermiso(req: NextRequest, permiso: PermisoKey): Promise<SessionPayload | null> {
  const session = await getSession(req);
  if (!session) return null;
  if (session.rol === 'admin') return session;
  if (session.rol === 'costurera') return null;
  const user = await prisma.usuario.findUnique({ where: { id: session.id }, select: { permisos: true } });
  return (user?.permisos ?? []).includes(permiso) ? session : null;
}

export async function requireInsumos(req: NextRequest): Promise<SessionPayload | null> {
  return requirePermiso(req, 'insumos');
}
