import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!await requirePermiso(req, 'costos')) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const { nombre, monto, categoria, activo } = await req.json();
  const data: Record<string, unknown> = {};
  if (nombre    !== undefined) data.nombre    = nombre.trim();
  if (monto     !== undefined) data.monto     = parseFloat(monto) || 0;
  if (categoria !== undefined) data.categoria = categoria;
  if (activo    !== undefined) data.activo    = Boolean(activo);
  const gasto = await prisma.gastoFijoTaller.update({ where: { id }, data });
  return NextResponse.json(gasto);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!await requirePermiso(req, 'costos')) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  await prisma.gastoFijoTaller.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
