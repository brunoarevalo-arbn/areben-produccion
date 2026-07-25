import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { signSession, SESSION_COOKIE, type SessionPayload } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    const usuario = await prisma.usuario.findUnique({ where: { username: username.toLowerCase().trim() } });

    if (!usuario || !usuario.activo) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
    }

    // Cuenta solo-Google (sin contraseña propia): no puede entrar por este camino.
    if (!usuario.passwordHash) {
      return NextResponse.json({ error: 'Esta cuenta ingresa con Google' }, { status: 401 });
    }

    const ok = await verifyPassword(password, usuario.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
    }

    const payload: SessionPayload = {
      id:       usuario.id,
      nombre:   usuario.nombre,
      username: usuario.username,
      rol:      usuario.rol as SessionPayload['rol'],
    };

    const token = await signSession(payload);

    const res = NextResponse.json({ ok: true, rol: usuario.rol, nombre: usuario.nombre, permisos: usuario.permisos });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path:     '/',
      maxAge:   60 * 60 * 24 * 7, // 7 días
      secure:   process.env.NODE_ENV === 'production',
    });

    return res;
  } catch (err) {
    console.error('[login]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
