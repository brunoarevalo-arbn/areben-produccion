import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireInsumos } from '@/lib/auth';
import { InsumoCatalogoSchema } from '@/lib/validators/insumos';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await requireInsumos(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = InsumoCatalogoSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const insumo = await prisma.insumo.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json(insumo);
}

// Eliminar inteligente: si el insumo no está en uso (sin rollos, lotes ni líneas
// de compra) se borra de verdad; si tiene historial, se desactiva y se avisa.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await requireInsumos(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;

  const [rollos, lotes, lineas] = await Promise.all([
    prisma.rollo.count({ where: { insumoId: id } }),
    prisma.lote.count({ where: { insumoId: id } }),
    prisma.compraLinea.count({ where: { insumoId: id } }),
  ]);

  if (rollos + lotes + lineas === 0) {
    await prisma.insumo.delete({ where: { id } }); // InsumoColor cae por cascade
    return NextResponse.json({ deleted: true });
  }

  await prisma.insumo.update({ where: { id }, data: { activo: false } });
  return NextResponse.json({
    deleted: false, deactivated: true,
    motivo: `Tiene historial asociado (${rollos} rollos, ${lotes} lotes, ${lineas} compras); se desactivó en vez de borrarse para no perderlo.`,
  });
}
