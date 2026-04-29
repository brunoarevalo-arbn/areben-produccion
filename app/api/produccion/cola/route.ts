import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

async function getSession(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const soloActivas = searchParams.get('soloActivas') === '1';

  const where = soloActivas
    ? { estado: { in: ['pendiente', 'en_produccion'] } }
    : {};

  const ordenes = await prisma.ordenProduccion.findMany({
    where,
    orderBy: [{ estado: 'asc' }, { createdAt: 'asc' }],
  });

  return NextResponse.json(ordenes);
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const body = await req.json();
  const { sku, descripcion, marca, cantidad, notas } = body;

  if (!sku?.trim()) {
    return NextResponse.json({ error: 'El SKU es obligatorio' }, { status: 400 });
  }

  const orden = await prisma.ordenProduccion.create({
    data: {
      sku:         sku.trim().toUpperCase(),
      descripcion: descripcion?.trim() || null,
      marca:       marca?.trim()       || 'Zattia',
      cantidad:    Math.max(1, parseInt(cantidad) || 1),
      notas:       notas?.trim()       || null,
      creadoPor:   session.nombre,
    },
  });

  return NextResponse.json(orden, { status: 201 });
}
