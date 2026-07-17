import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Solo el $/m de sublimación, para que la ficha de corte pueda previsualizar el costo.
// Sesión válida y nada más (mismo criterio que /costos/costos-corte y /costos/etiquetas):
// lo consume producción, que no tiene por qué ver los márgenes del resto de la config.
// Se edita desde /api/costos/config (permiso 'costos').
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySession(token))) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });
  const cfg = await prisma.configCostos.findUnique({
    where: { id: 'singleton' },
    select: { sublimacionPrecioMetro: true },
  });
  return NextResponse.json({ sublimacionPrecioMetro: cfg?.sublimacionPrecioMetro ?? 0 });
}
