import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { ProveedorSchema } from '@/lib/validators/insumos';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'proveedores');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = ProveedorSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const proveedor = await prisma.proveedor.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json(proveedor);
}

// Eliminar inteligente: si el proveedor no tiene compras, gastos ni avíos, se
// borra de verdad; si tiene historial, se desactiva y se avisa el motivo.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'proveedores');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;

  const [compras, gastos, avios] = await Promise.all([
    prisma.compra.count({ where: { proveedorId: id } }),
    prisma.gasto.count({ where: { proveedorId: id } }),
    prisma.etiquetaCatalogo.count({ where: { proveedorId: id } }),
  ]);

  if (compras + gastos + avios === 0) {
    await prisma.proveedor.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  }

  await prisma.proveedor.update({ where: { id }, data: { activo: false } });
  return NextResponse.json({
    deleted: false, deactivated: true,
    motivo: `Tiene historial asociado (${compras} compras, ${gastos} gastos, ${avios} avíos); se desactivó en vez de borrarse para no perderlo.`,
  });
}
