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

  // El tiempo total de costura es la suma de TODOS los procesos (mangas, cuello,
  // ruedo, etc.) de toda la tanda.
  const minutosTotales = registros.reduce((s, r) => s + r.minutosNetos, 0);

  // La cantidad PRODUCIDA es fija: la del/los OP del SKU (el corte), NO la suma de
  // las cantidades de cada proceso. La misma tanda de 38 pasa por N procesos, y
  // sumar esas cantidades daría 38×N (508). Fallback sin OP: el máximo preseteado.
  const ops = await prisma.ordenProduccion.findMany({
    where:  { sku: { equals: sku, mode: 'insensitive' }, cantidad: { gt: 0 } },
    select: { cantidad: true },
  });
  let cantidadProducida = ops.reduce((s, o) => s + o.cantidad, 0);
  if (cantidadProducida === 0) cantidadProducida = Math.max(...registros.map((r) => r.cantidad));

  const minutosPromedio = cantidadProducida > 0 ? minutosTotales / cantidadProducida : 0;

  return NextResponse.json({
    encontrado:      true,
    minutosPromedio: Math.round(minutosPromedio * 10) / 10,
    cantidadTotal:   cantidadProducida,
    registros:       registros.length,
  });
}
