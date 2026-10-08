import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';

// /auth/callback es la vuelta de Google: llega SIN sesión a propósito (trae el
// code a canjear). Si no fuera pública, el proxy la mandaría al login y el
// ingreso nunca cerraría (login → Google → callback → login → ...).
const PUBLIC_PATHS = ['/login', '/auth/callback', '/api/auth/login', '/api/usuarios'];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and static files
  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/')) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  // 🔴 Una API sin sesión contesta 401, ⛔ no un redirect al login: el redirect lo
  // seguía axios y le devolvía la página de login con un 200 ⇒ la tablet creía
  // haber guardado (7-oct, 3 guardados perdidos así). Con 401 el cliente SABE que
  // se cerró la sesión y el reloj no se toca.
  if (!session && pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Se cerró la sesión', sesionVencida: true }, { status: 401 });
  }

  // Not logged in → redirect to login
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Costurera can only access /tiempos and /api/tiempos
  if (session.rol === 'costurera') {
    const allowed =
      pathname.startsWith('/tiempos') ||
      pathname.startsWith('/api/tiempos') ||
      pathname.startsWith('/api/auth');

    if (!allowed) {
      const url = req.nextUrl.clone();
      url.pathname = '/tiempos';
      return NextResponse.redirect(url);
    }
  }

  // Estampador solo accede a su tablet /estampado
  if (session.rol === 'estampador') {
    const allowed =
      pathname.startsWith('/estampado') ||
      pathname.startsWith('/api/estampado') ||
      pathname.startsWith('/api/auth');

    if (!allowed) {
      const url = req.nextUrl.clone();
      url.pathname = '/estampado';
      return NextResponse.redirect(url);
    }
  }

  // If logged-in user tries to go to /login → redirect to su pantalla
  if (pathname === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = session.rol === 'costurera' ? '/tiempos' : session.rol === 'estampador' ? '/estampado' : '/dashboard';
    return NextResponse.redirect(url);
  }

  // Sesión deslizante: cada uso la estira otros 7 días (ver `SESSION_MAX_AGE`).
  // `/api/auth` queda afuera: el logout borra la cookie y no hay que pisarlo.
  const res = NextResponse.next();
  if (token && !pathname.startsWith('/api/auth')) {
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
