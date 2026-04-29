import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session || session.rol !== 'admin') return null;
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.nombre)    data.nombre = body.nombre.trim();
  if (body.username)  data.username = body.username.trim().toLowerCase();
  if (body.password)  data.passwordHash = await hashPassword(body.password);
  if (body.rol)       data.rol = body.rol === 'costurera' ? 'costurera' : 'admin';
  if (typeof body.activo === 'boolean') data.activo = body.activo;

  const updated = await prisma.usuario.update({
    where: { id },
    data,
    select: { id: true, nombre: true, username: true, rol: true, activo: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;

  // Can't delete yourself
  if (id === session.id) {
    return NextResponse.json({ error: 'No podés eliminarte a vos mismo' }, { status: 400 });
  }

  await prisma.usuario.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
