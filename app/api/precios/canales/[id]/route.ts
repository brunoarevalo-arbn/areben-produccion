import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'precios'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const b = await req.json();
  const data: Record<string, unknown> = {};
  if (b.nombre !== undefined)        data.nombre        = String(b.nombre).trim();
  if (b.costoPorVenta !== undefined) data.costoPorVenta = Number(b.costoPorVenta) || 0;
  if (b.costoEsPct !== undefined)    data.costoEsPct    = !!b.costoEsPct;
  if (b.activo !== undefined)        data.activo        = !!b.activo;
  const canal = await prisma.canalVenta.update({ where: { id }, data, include: { comisiones: { orderBy: { orden: 'asc' } } } });
  return NextResponse.json(canal);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'precios'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  await prisma.canalVenta.delete({ where: { id } }); // borra sus comisiones en cascada
  return NextResponse.json({ deleted: true });
}
