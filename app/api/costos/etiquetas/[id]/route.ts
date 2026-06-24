import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAlguno } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!(await requireAlguno(req, ['costos', 'insumos']))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.nombre !== undefined) {
    if (!body.nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
    data.nombre = body.nombre.trim();
  }
  if (body.tipo      !== undefined) data.tipo      = body.tipo?.trim() || null;
  if (body.categoria !== undefined) data.categoria = body.categoria?.trim() || null;
  if (body.frecuencia !== undefined) data.frecuencia = body.frecuencia === 'ocasional' ? 'ocasional' : 'habitual';
  if (body.unidad    !== undefined) data.unidad    = body.unidad?.trim() || null;
  if (body.marca     !== undefined) data.marca     = body.marca?.trim() || null;
  if (body.proveedorId !== undefined) data.proveedorId = body.proveedorId || null;
  if (body.precio !== undefined) data.precio = parseFloat(body.precio) || 0;
  if (body.activo !== undefined) data.activo = !!body.activo;
  // stock: null = sin seguimiento / ilimitado; número = empieza a trackear
  if (body.stock  !== undefined) data.stock  = body.stock === null ? null : Math.max(0, Math.trunc(Number(body.stock) || 0));
  const item = await prisma.etiquetaCatalogo.update({ where: { id }, data });
  return NextResponse.json(item);
}

// Eliminar inteligente: si el avío no tiene órdenes ni movimientos, se borra de
// verdad; si tiene historial, se desactiva (baja lógica) para no perderlo.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!(await requireAlguno(req, ['costos', 'insumos']))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;

  const [ordenes, movimientos] = await Promise.all([
    prisma.ordenAvio.count({ where: { etiquetaId: id } }),
    prisma.avioMovimiento.count({ where: { etiquetaId: id } }),
  ]);

  if (ordenes + movimientos === 0) {
    await prisma.etiquetaCatalogo.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: true });
  }

  await prisma.etiquetaCatalogo.update({ where: { id }, data: { activo: false } });
  return NextResponse.json({
    ok: true, deleted: false, deactivated: true,
    motivo: `Tiene historial asociado (${ordenes} órdenes, ${movimientos} movimientos); se desactivó en vez de borrarse.`,
  });
}
