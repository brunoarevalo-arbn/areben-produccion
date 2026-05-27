import { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE, SessionPayload } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function requireAdmin(req: NextRequest): Promise<SessionPayload | null> {
  const session = await getSession(req);
  if (!session) return null;
  if (session.rol === 'admin') return session;
  return null;
}

export async function requireInsumos(req: NextRequest): Promise<SessionPayload | null> {
  const session = await getSession(req);
  if (!session) return null;
  if (session.rol === 'admin') return session;
  if (session.rol === 'costurera') return null;
  const user = await prisma.usuario.findUnique({ where: { id: session.id }, select: { permisos: true } });
  const bloqueadas = user?.permisos ?? [];
  if (bloqueadas.includes('insumos')) return null;
  return session;
}
