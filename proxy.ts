import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/usuarios'];

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

  // If logged-in admin tries to go to /login → redirect to dashboard
  if (pathname === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = session.rol === 'costurera' ? '/tiempos' : '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
