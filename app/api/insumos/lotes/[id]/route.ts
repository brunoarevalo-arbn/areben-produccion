import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSession, requireInsumos } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const lote = await prisma.lote.findUnique({
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

  if (!lote) return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 });
  return NextResponse.json(lote);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await requireInsumos(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.colorId !== undefined) data.colorId = body.colorId || null;
  if (body.costoUnitario !== undefined) {
    const c = Number(body.costoUnitario);
    if (!isFinite(c) || c < 0) return NextResponse.json({ error: 'Costo inválido' }, { status: 400 });
    data.costoUnitario = new Prisma.Decimal(c);
  }

  const lote = await prisma.lote.update({ where: { id }, data });
  return NextResponse.json(lote);
}
