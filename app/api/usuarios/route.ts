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

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) {
    // Bootstrap detection: return empty array only when no users exist
    const count = await prisma.usuario.count();
    if (count === 0) return NextResponse.json([]);
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const usuarios = await prisma.usuario.findMany({
    select: { id: true, nombre: true, username: true, rol: true, activo: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(usuarios);
}

export async function POST(req: NextRequest) {
  // Allow first user creation without auth (bootstrap)
  const count = await prisma.usuario.count();
  if (count > 0) {
    const session = await requireAdmin(req);
    if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const { nombre, username, password, rol } = await req.json();

  if (!nombre?.trim() || !username?.trim() || !password?.trim()) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  }

  const exists = await prisma.usuario.findUnique({ where: { username: username.toLowerCase().trim() } });
  if (exists) return NextResponse.json({ error: 'El usuario ya existe' }, { status: 409 });

  const passwordHash = await hashPassword(password);
  const usuario = await prisma.usuario.create({
    data: {
      nombre: nombre.trim(),
      username: username.toLowerCase().trim(),
      passwordHash,
      rol: rol === 'costurera' ? 'costurera' : 'admin',
    },
    select: { id: true, nombre: true, username: true, rol: true, activo: true, createdAt: true },
  });

  return NextResponse.json(usuario, { status: 201 });
}
