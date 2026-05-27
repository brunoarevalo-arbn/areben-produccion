import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

async function getSession(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

async function requireProduccionAccess(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return null;
  if (session.rol === 'admin') return session;
  if (session.rol === 'costurera') return null;
  const user = await prisma.usuario.findUnique({ where: { id: session.id }, select: { permisos: true } });
  if (!user?.permisos.includes('produccion')) return session;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

    const ordenes = await prisma.ordenProduccion.findMany({
      orderBy: [{ estado: 'asc' }, { createdAt: 'asc' }],
      include: {
        transiciones: {
          orderBy: { fecha: 'desc' },
          take: 1,
          select: { fecha: true, estadoNuevo: true },
        },
      },
    });

    return NextResponse.json(ordenes);
  } catch (err) {
    console.error('[cola GET]', err);
    return NextResponse.json({ error: 'Error interno', detail: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await requireProduccionAccess(req);
  if (!session) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const body = await req.json();
  const { sku, descripcion, marca, cantidad, notas } = body;

  if (!sku?.trim()) {
    return NextResponse.json({ error: 'El SKU es obligatorio' }, { status: 400 });
  }

  const orden = await prisma.$transaction(async (tx) => {
    const op = await tx.ordenProduccion.create({
      data: {
        sku:         sku.trim().toUpperCase(),
        descripcion: descripcion?.trim() || null,
        marca:       marca?.trim()       || 'Zattia',
        cantidad:    Math.max(1, parseInt(cantidad) || 1),
        notas:       notas?.trim()       || null,
        creadoPor:   session.nombre,
      },
    });
    await tx.estadoTransicion.create({
      data: {
        ordenId:     op.id,
        estadoAnterior: null,
        estadoNuevo: 'PENDIENTE',
        usuarioId:   session.id,
        notas:       'OP creada',
      },
    });
    return op;
  });

  return NextResponse.json(orden, { status: 201 });
}
