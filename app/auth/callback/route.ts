import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { signSession, SESSION_COOKIE, type SessionPayload } from '@/lib/session';

/**
 * Vuelta del ingreso con Google. El flujo:
 *   1. Canjea el `code` con Supabase y lee el email de la cuenta.
 *   2. Busca ese email en `usuarios` (activo). Si no está, la cuenta de Google es
 *      válida pero no tiene acceso al sistema → mensaje claro, no un error crudo.
 *   3. Emite la cookie de sesión PROPIA de producción (`areben_session`, HMAC),
 *      exactamente igual que el login por contraseña. De acá en más el resto de la
 *      app no se entera de que hubo Google de por medio: sigue leyendo esa cookie.
 *
 * No se persiste sesión de Supabase: se usa sólo para verificar la identidad.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const errorDescription = searchParams.get('error_description');

  if (errorDescription || !code) {
    return redirectLogin(origin, code ? 'google' : 'sin-codigo');
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const email = data?.user?.email?.toLowerCase().trim();

  if (error || !email) {
    return redirectLogin(origin, 'google');
  }

  // Identidad efímera: no dejamos viva la sesión de Supabase.
  await supabase.auth.signOut();

  const usuario = await prisma.usuario.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, activo: true },
  });

  if (!usuario) {
    return redirectLogin(origin, 'sin-acceso');
  }

  const payload: SessionPayload = {
    id: usuario.id,
    nombre: usuario.nombre,
    username: usuario.username,
    rol: usuario.rol as SessionPayload['rol'],
  };
  const token = await signSession(payload);

  const res = NextResponse.redirect(`${origin}${destinoPorRol(usuario.rol, usuario.permisos)}`);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 días, igual que el login por contraseña
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}

/**
 * Mismo ruteo que el login por contraseña (app/(auth)/login/page.tsx): costurera a
 * la tablet, cortador a su panel, el resto al dashboard. Los usuarios de Google son
 * admin/diseñadoras, pero se replica igual por robustez.
 */
function destinoPorRol(rol: string, permisos: string[]): string {
  if (rol === 'costurera') return '/tiempos';
  if (rol !== 'admin' && permisos.includes('cortador') && !permisos.includes('dashboard')) {
    return '/cortador';
  }
  return '/dashboard';
}

function redirectLogin(origin: string, error: string): NextResponse {
  return NextResponse.redirect(`${origin}/login?error=${error}`);
}
