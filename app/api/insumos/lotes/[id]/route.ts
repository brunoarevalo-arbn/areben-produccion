import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const lote = await prisma.lote.findUnique({
    where: { id },
    include: {
      insumo: { select: { nombre: true, categoria: true, unidadDefault: true } },
      compra: { select: { id: true, fecha: true, numeroFactura: true, proveedor: { select: { nombre: true } } } },
      movimientos: {
        orderBy: { fecha: 'desc' },
      },
    },
  });

  if (!lote) return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 });
  return NextResponse.json(lote);
}
