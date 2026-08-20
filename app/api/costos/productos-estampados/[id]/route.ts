import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { normalizarLisoRef, lisoRefValida, ERROR_LISO } from '@/lib/costos/lisoRef';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'costos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const { nombre, sku, marca, estampas, notas } = body;
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  const liso = normalizarLisoRef(body);
  if (!lisoRefValida(liso)) return NextResponse.json({ error: ERROR_LISO }, { status: 400 });
  const producto = await prisma.productoEstampado.update({
    where: { id },
    data: {
      nombre: nombre.trim(),
      sku: sku?.trim() || null,
      marca: marca?.trim() || null,
      ...liso,
      estampas: Array.isArray(estampas) ? estampas : [],
      notas: notas?.trim() || null,
    },
  });
  return NextResponse.json(producto);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'costos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  await prisma.productoEstampado.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
