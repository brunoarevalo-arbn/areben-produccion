import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

async function requireAccess(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return null;
  if (session.rol === 'admin') return session;
  if (session.rol === 'costurera') return null;
  const user = await prisma.usuario.findUnique({ where: { id: session.id }, select: { permisos: true } });
  if (!user?.permisos.includes('gastos')) return session;
  return null;
}

export async function GET(req: NextRequest) {
  const session = await requireAccess(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const categoria = searchParams.get('categoria');
  const marca     = searchParams.get('marca');

  const gastos = await prisma.gasto.findMany({
    where: {
      ...(categoria ? { categoria } : {}),
      ...(marca     ? { marca }     : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(gastos);
}

export async function POST(req: NextRequest) {
  const session = await requireAccess(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const body = await req.json();
  const { categoria, tipo, marca, sku, ordenId, minutos, monto, concepto, fecha, tiempoId } = body;

  if (!categoria || !tipo || !fecha) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
  }

  const gasto = await prisma.gasto.create({
    data: {
      categoria,
      tipo,
      marca:    marca    || null,
      sku:      sku      || null,
      ordenId:  ordenId  || null,
      minutos:  minutos  ? parseInt(minutos) : null,
      monto:    parseFloat(monto) || 0,
      concepto: concepto || null,
      fecha,
      creadoPor: session.nombre,
      tiempoId: tiempoId || null,
    },
  });

  return NextResponse.json(gasto, { status: 201 });
}
