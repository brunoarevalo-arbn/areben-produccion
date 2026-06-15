import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string; skuId: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  try {
    const { skuId } = await params;
    const body      = await req.json();

    const data: Record<string, unknown> = {};
    if (body.codigo   !== undefined) data.codigo   = body.codigo.trim().toUpperCase();
    if (body.talle    !== undefined) data.talle    = body.talle    || null;
    if (body.color    !== undefined) data.color    = body.color    || null;
    if (body.cantidad !== undefined) data.cantidad = body.cantidad ?? 0;
    if (body.notas    !== undefined) data.notas    = body.notas    || null;

    const sku = await prisma.sKUProyecto.update({ where: { id: skuId }, data });
    return NextResponse.json({
      ...sku,
      createdAt: sku.createdAt.toISOString(),
      updatedAt: sku.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error actualizando SKU' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  try {
    const { skuId } = await params;
    await prisma.sKUProyecto.delete({ where: { id: skuId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error eliminando SKU' }, { status: 500 });
  }
}
