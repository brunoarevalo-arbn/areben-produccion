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

  const { id } = await params;
  const body = await req.json();
  const { estado, descripcion, cantidad, notas } = body;

  const editaContenido =
    descripcion !== undefined || cantidad !== undefined || notas !== undefined;

  // Cambiar estado lo puede hacer cualquier usuario logueado (costureras marcan
  // 'terminado' desde /tiempos). Editar descripción/cantidad/notas requiere
  // permiso de producción, igual que crear o eliminar.
  if (editaContenido) {
    const allowed = await requireProduccionAccess(req);
    if (!allowed) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const data: Record<string, unknown> = {};

  if (estado !== undefined) {
    const ESTADOS_VALIDOS = ['pendiente', 'en_produccion', 'terminado'];
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
    }
    data.estado = estado;
    data.terminadoAt = estado === 'terminado' ? new Date() : null;
  }

  if (descripcion !== undefined) {
    data.descripcion = typeof descripcion === 'string' && descripcion.trim()
      ? descripcion.trim()
      : null;
  }

  if (cantidad !== undefined) {
    const n = parseInt(cantidad);
    if (!Number.isFinite(n) || n < 1) {
      return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 });
    }
    data.cantidad = n;
  }

  if (notas !== undefined) {
    data.notas = typeof notas === 'string' && notas.trim() ? notas.trim() : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
  }

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
