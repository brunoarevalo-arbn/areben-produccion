import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'costos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const { nombre, sku, marca, lisoEscandalloId, estampas, notas } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  if (!lisoEscandalloId) return NextResponse.json({ error: 'Elegí el liso base' }, { status: 400 });
  const producto = await prisma.productoEstampado.update({
    where: { id },
    data: {
      nombre: nombre.trim(),
      sku: sku?.trim() || null,
      marca: marca?.trim() || null,
      lisoEscandalloId,
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
