import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireInsumos } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const rollo = await prisma.rollo.findUnique({
    where: { id },
    include: {
      insumo: { select: { nombre: true, categoria: true, unidadDefault: true } },
      color: { select: { id: true, nombre: true, abreviatura: true } },
      compra: { select: { id: true, fecha: true, numeroFactura: true, proveedor: { select: { nombre: true } } } },
      movimientos: {
        orderBy: { fecha: 'desc' },
      },
    },
  });

  if (!rollo) return NextResponse.json({ error: 'Rollo no encontrado' }, { status: 404 });
  return NextResponse.json(rollo);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await requireInsumos(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const { colorId } = await req.json();

  const rollo = await prisma.rollo.update({
    where: { id },
    data: { colorId: colorId || null },
  });

  return NextResponse.json(rollo);
}
