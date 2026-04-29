import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string; insumoId: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { insumoId } = await params;
    const body         = await req.json();

    const data: Record<string, unknown> = {};
    const campos = ['nombre', 'tipo', 'proveedor', 'unidad', 'cantidad', 'costoUnitario', 'notas'] as const;
    for (const c of campos) {
      if (body[c] !== undefined) data[c] = body[c] === '' ? null : body[c];
    }
    if (body.nombre !== undefined) data.nombre = body.nombre.trim();

    const insumo = await prisma.proyectoInsumo.update({ where: { id: insumoId }, data });
    return NextResponse.json({
      ...insumo,
      createdAt: insumo.createdAt.toISOString(),
      updatedAt: insumo.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error actualizando insumo' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { insumoId } = await params;
    await prisma.proyectoInsumo.delete({ where: { id: insumoId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error eliminando insumo' }, { status: 500 });
  }
}
