import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAlguno } from '@/lib/auth';

// Gemelo de /api/insumos/rollos para la pista de avíos: también devuelve
// `costoUnitario`, así que no puede quedar en sesión pelada.
export async function GET(req: NextRequest) {
  const session = await requireAlguno(req, ['insumos', 'produccion']);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const url = new URL(req.url);
  const insumoId = url.searchParams.get('insumoId');
  const estado = url.searchParams.get('estado');

  const where: Record<string, unknown> = {};
  if (insumoId) where.insumoId = insumoId;
  if (estado) where.estado = estado;

  const lotes = await prisma.lote.findMany({
    where,
    include: {
      insumo: { select: { nombre: true, categoria: true, unidadDefault: true } },
      color: { select: { id: true, nombre: true, abreviatura: true } },
      compra: { select: { id: true, fecha: true, proveedor: { select: { nombre: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(lotes);
}
