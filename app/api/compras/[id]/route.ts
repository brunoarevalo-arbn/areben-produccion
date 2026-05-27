import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const compra = await prisma.compra.findUnique({
    where: { id },
    include: {
      proveedor: true,
      lineas: {
        include: { insumo: { select: { nombre: true, categoria: true, tipoTrazabilidad: true } } },
      },
      rollos: {
        include: { insumo: { select: { nombre: true } } },
      },
      lotes: {
        include: { insumo: { select: { nombre: true } } },
      },
    },
  });

  if (!compra) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });
  return NextResponse.json(compra);
}
