import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  return session?.rol === 'admin' ? session : null;
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySession(token))) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });
  const { id } = await params;
  const escandallo = await prisma.escandallo.findUnique({
    where: { id },
    include: { materiales: { orderBy: { orden: 'asc' } } },
  });
  if (!escandallo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(escandallo);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.nombre     !== undefined) data.nombre     = body.nombre.trim();
  if (body.sku        !== undefined) data.sku        = body.sku?.trim()   || null;
  if (body.marca      !== undefined) data.marca      = body.marca?.trim() || null;
  if (body.proyectoId !== undefined) data.proyectoId = body.proyectoId    || null;
  if (body.notas      !== undefined) data.notas      = body.notas?.trim() || null;
  if (body.margen     !== undefined) data.margen     = parseFloat(body.margen) || 2.5;

  // Upsert materials if provided
  if (body.materiales !== undefined) {
    await prisma.escandalloMaterial.deleteMany({ where: { escandalloId: id } });
    if (body.materiales.length > 0) {
      await prisma.escandalloMaterial.createMany({
        data: body.materiales.map((m: { nombre: string; cantidad: number; unidad: string; costoUnitario: number }, i: number) => ({
          escandalloId: id,
          nombre:       m.nombre,
          cantidad:     parseFloat(String(m.cantidad))      || 1,
          unidad:       m.unidad       || 'm',
          costoUnitario: parseFloat(String(m.costoUnitario)) || 0,
          orden:        i,
        })),
      });
    }
  }

  const escandallo = await prisma.escandallo.update({
    where: { id },
    data,
    include: { materiales: { orderBy: { orden: 'asc' } } },
  });
  return NextResponse.json(escandallo);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  await prisma.escandallo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
