import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

// Historial de movimientos (ingreso/egreso/ajuste) de un avío del catálogo.
export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const movimientos = await prisma.avioMovimiento.findMany({
    where: { etiquetaId: id },
    orderBy: { fecha: 'desc' },
    take: 100,
  });
  return NextResponse.json(movimientos);
}
