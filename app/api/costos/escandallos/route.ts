import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  return session?.rol === 'admin' ? session : null;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySession(token))) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });
  const escandallos = await prisma.escandallo.findMany({
    include: { materiales: { orderBy: { orden: 'asc' } } },
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json(escandallos);
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { nombre, sku, marca, proyectoId, notas, margen } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  const escandallo = await prisma.escandallo.create({
    data: {
      nombre: nombre.trim(),
      sku:        sku?.trim()        || null,
      marca:      marca?.trim()      || null,
      proyectoId: proyectoId         || null,
      notas:      notas?.trim()      || null,
      margen:     parseFloat(margen) || 2.5,
    },
    include: { materiales: true },
  });
  return NextResponse.json(escandallo, { status: 201 });
}
