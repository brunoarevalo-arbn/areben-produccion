import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { requirePermiso } from '@/lib/auth';

const ROLES_VALIDOS = ['admin', 'costurera', 'diseñadora'];

export async function GET(req: NextRequest) {
  const session = await requirePermiso(req, 'usuarios');
  if (!session) {
    const count = await prisma.usuario.count();
    if (count === 0) return NextResponse.json([]);
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const usuarios = await prisma.usuario.findMany({
    select: { id: true, nombre: true, username: true, rol: true, permisos: true, activo: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(usuarios);
}

export async function POST(req: NextRequest) {
  const count = await prisma.usuario.count();
  if (count > 0) {
    const session = await requirePermiso(req, 'usuarios');
    if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const { nombre, username, password, rol, permisos } = await req.json();

  if (!nombre?.trim() || !username?.trim() || !password?.trim()) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  }

  const exists = await prisma.usuario.findUnique({ where: { username: username.toLowerCase().trim() } });
  if (exists) return NextResponse.json({ error: 'El usuario ya existe' }, { status: 409 });

  const rolValido = ROLES_VALIDOS.includes(rol) ? rol : 'costurera';
  const passwordHash = await hashPassword(password);

  const usuario = await prisma.usuario.create({
    data: {
      nombre:   nombre.trim(),
      username: username.toLowerCase().trim(),
      passwordHash,
      rol:      rolValido,
      permisos: Array.isArray(permisos) ? permisos : [],
    },
    select: { id: true, nombre: true, username: true, rol: true, permisos: true, activo: true, createdAt: true },
  });

  return NextResponse.json(usuario, { status: 201 });
}
