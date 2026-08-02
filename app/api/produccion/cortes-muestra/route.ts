import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

// Muestras cargadas por los cortadores (para validar y pagar). Filtros: estado
// ('pendiente'|'validado') y pago ('pendiente'|'pagado'). Trae el pago asociado
// (beneficiario incluido), así que va con `produccion` como la pantalla que la usa.
export async function GET(req: NextRequest) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const url = new URL(req.url);
  const estado = url.searchParams.get('estado');
  const pago = url.searchParams.get('pago');
  const where: Record<string, unknown> = {};
  if (estado) where.estado = estado;
  if (pago === 'pendiente') where.pagoCorteId = null;
  if (pago === 'pagado') where.pagoCorteId = { not: null };

  const muestras = await prisma.corteMuestra.findMany({
    where,
    orderBy: { fecha: 'desc' },
    include: { cortador: { select: { nombre: true } }, pagoCorte: { select: { id: true, fecha: true, beneficiario: true } } },
  });
  return NextResponse.json(muestras);
}
