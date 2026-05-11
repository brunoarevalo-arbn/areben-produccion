import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

async function getSession(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

async function requireProduccionAccess(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return null;
  if (session.rol === 'admin') return session;
  if (session.rol === 'costurera') return null;
  const user = await prisma.usuario.findUnique({ where: { id: session.id }, select: { permisos: true } });
  if (!user?.permisos.includes('produccion')) return session;
  return null;
}

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });
  // PATCH (cambiar estado) lo puede hacer cualquier usuario logueado — costureras
  // marcan 'terminado' desde /tiempos al finalizar un corte.

  const { id } = await params;
  const { estado } = await req.json();

  const ESTADOS_VALIDOS = ['pendiente', 'en_produccion', 'terminado'];
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
  }

  const data: Record<string, unknown> = { estado };
  if (estado === 'terminado') data.terminadoAt = new Date();
  else data.terminadoAt = null;

  const orden = await prisma.ordenProduccion.update({ where: { id }, data });
  return NextResponse.json(orden);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await requireProduccionAccess(req);
  if (!session) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const { id } = await params;
  await prisma.ordenProduccion.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
