import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAlguno } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

// Historial de movimientos (ingreso/egreso/ajuste) de un avío del catálogo.
// Cada movimiento trae `costoUnitario`: no va con sesión pelada.
export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await requireAlguno(req, ['insumos', 'costos']);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const movimientos = await prisma.avioMovimiento.findMany({
    where: { etiquetaId: id },
    orderBy: { fecha: 'desc' },
    take: 100,
  });
  return NextResponse.json(movimientos);
}
