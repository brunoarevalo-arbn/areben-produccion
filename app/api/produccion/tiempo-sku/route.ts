import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySession(token))) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const sku = req.nextUrl.searchParams.get('sku')?.trim();
  if (!sku) return NextResponse.json({ error: 'SKU requerido' }, { status: 400 });

  const registros = await prisma.tiemposProduccion.findMany({
    where: {
      sku:          { equals: sku, mode: 'insensitive' },
      cantidad:     { gt: 0 },
      minutosNetos: { gt: 0 },
    },
    select: { minutosNetos: true, cantidad: true },
  });

  if (registros.length === 0) return NextResponse.json({ encontrado: false });

  const minutosTotales  = registros.reduce((s, r) => s + r.minutosNetos, 0);
  const cantidadTotal   = registros.reduce((s, r) => s + r.cantidad, 0);
  const minutosPromedio = cantidadTotal > 0 ? minutosTotales / cantidadTotal : 0;

  return NextResponse.json({
    encontrado:     true,
    minutosPromedio: Math.round(minutosPromedio * 10) / 10,
    cantidadTotal,
    registros:      registros.length,
  });
}
