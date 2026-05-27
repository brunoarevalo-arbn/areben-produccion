import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireInsumos } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const colores = await prisma.insumoColor.findMany({
    where: { insumoId: id },
    include: { skuCatalogo: { select: { id: true, nombre: true, abreviatura: true } } },
    orderBy: { skuCatalogo: { nombre: 'asc' } },
  });

  return NextResponse.json(colores);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requireInsumos(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const { skuCatalogoId } = await req.json();

  if (!skuCatalogoId) {
    return NextResponse.json({ error: 'Color obligatorio' }, { status: 400 });
  }

  const existe = await prisma.insumoColor.findUnique({
    where: { insumoId_skuCatalogoId: { insumoId: id, skuCatalogoId } },
  });

  if (existe) {
    if (!existe.activo) {
      const reactivado = await prisma.insumoColor.update({
        where: { id: existe.id },
        data: { activo: true },
        include: { skuCatalogo: { select: { id: true, nombre: true, abreviatura: true } } },
      });
      return NextResponse.json(reactivado);
    }
    return NextResponse.json({ error: 'Color ya asociado' }, { status: 400 });
  }

  const color = await prisma.insumoColor.create({
    data: { insumoId: id, skuCatalogoId },
    include: { skuCatalogo: { select: { id: true, nombre: true, abreviatura: true } } },
  });

  return NextResponse.json(color, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await requireInsumos(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const { insumoColorId, activo } = await req.json();

  if (!insumoColorId) {
    return NextResponse.json({ error: 'ID obligatorio' }, { status: 400 });
  }

  const color = await prisma.insumoColor.update({
    where: { id: insumoColorId, insumoId: id },
    data: { activo },
    include: { skuCatalogo: { select: { id: true, nombre: true, abreviatura: true } } },
  });

  return NextResponse.json(color);
}
