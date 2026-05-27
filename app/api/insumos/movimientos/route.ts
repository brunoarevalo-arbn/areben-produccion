import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const url = new URL(req.url);
  const tipo = url.searchParams.get('tipo');
  const rolloId = url.searchParams.get('rolloId');
  const loteId = url.searchParams.get('loteId');
  const desde = url.searchParams.get('desde');
  const hasta = url.searchParams.get('hasta');

  const where: Record<string, unknown> = {};
  if (tipo) where.tipo = tipo;
  if (rolloId) where.rolloId = rolloId;
  if (loteId) where.loteId = loteId;
  if (desde || hasta) {
    where.fecha = {};
    if (desde) (where.fecha as Record<string, unknown>).gte = new Date(desde);
    if (hasta) (where.fecha as Record<string, unknown>).lte = new Date(hasta);
  }

  const movimientos = await prisma.movimientoInsumo.findMany({
    where,
    include: {
      rollo: { select: { codigo: true, insumo: { select: { nombre: true } } } },
      lote:  { select: { codigo: true, insumo: { select: { nombre: true } } } },
    },
    orderBy: { fecha: 'desc' },
    take: 200,
  });

  return NextResponse.json(movimientos);
}
