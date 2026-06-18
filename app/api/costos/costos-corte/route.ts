import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { requirePermiso } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySession(token))) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });
  const items = await prisma.costoCortePrenda.findMany({ where: { activo: true }, orderBy: { tipoPrenda: 'asc' } });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  if (!(await requirePermiso(req, 'costos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { tipoPrenda, costo } = await req.json();
  if (!tipoPrenda?.trim()) return NextResponse.json({ error: 'Tipo de prenda requerido' }, { status: 400 });
  try {
    const item = await prisma.costoCortePrenda.create({
      data: { tipoPrenda: tipoPrenda.trim(), costo: parseFloat(costo) || 0 },
    });
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Ya existe un costo para ese tipo de prenda' }, { status: 409 });
  }
}
