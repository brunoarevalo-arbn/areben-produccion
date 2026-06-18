import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'costos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.tipoPrenda !== undefined) {
    if (!body.tipoPrenda?.trim()) return NextResponse.json({ error: 'Tipo de prenda requerido' }, { status: 400 });
    data.tipoPrenda = body.tipoPrenda.trim();
  }
  if (body.costo  !== undefined) data.costo  = parseFloat(body.costo) || 0;
  if (body.activo !== undefined) data.activo = !!body.activo;
  try {
    const item = await prisma.costoCortePrenda.update({ where: { id }, data });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: 'Ya existe un costo para ese tipo de prenda' }, { status: 409 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'costos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  await prisma.costoCortePrenda.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
