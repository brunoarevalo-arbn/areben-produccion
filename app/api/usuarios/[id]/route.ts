import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { requirePermiso } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermiso(req, 'usuarios');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};

  const ROLES_VALIDOS = ['admin', 'costurera', 'diseñadora'];
  if (body.nombre)    data.nombre = body.nombre.trim();
  if (body.username)  data.username = body.username.trim().toLowerCase();
  if (body.password)  data.passwordHash = await hashPassword(body.password);
  if (body.rol && ROLES_VALIDOS.includes(body.rol)) data.rol = body.rol;
  if (Array.isArray(body.permisos)) data.permisos = body.permisos;
  if (typeof body.activo === 'boolean') data.activo = body.activo;

  try {
    const updated = await prisma.usuario.update({
      where: { id },
      data,
      select: { id: true, nombre: true, username: true, rol: true, permisos: true, activo: true },
    });
    return NextResponse.json(updated);
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'code' in err && err.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un usuario con ese nombre de usuario' }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermiso(req, 'usuarios');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;

  // Can't delete yourself
  if (id === session.id) {
    return NextResponse.json({ error: 'No podés eliminarte a vos mismo' }, { status: 400 });
  }

  await prisma.usuario.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
