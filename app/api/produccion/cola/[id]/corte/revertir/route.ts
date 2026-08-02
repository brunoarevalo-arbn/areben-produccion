import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { revertirCorteOrden, CorteError } from '@/lib/produccion/corte';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const orden = await prisma.ordenProduccion.findUnique({
    where: { id },
    select: { fichaCorteCargada: true },
  });

  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });
  if (!orden.fichaCorteCargada) return NextResponse.json({ error: 'No hay corte registrado' }, { status: 400 });

  // Misma reversión que usa la edición de ficha (`../route.ts`): repone el NETO pendiente
  // por rollo. Esta ruta tenía una copia a mano que reponía cada CONSUMO histórico uno por
  // uno, así que la 2ª reversión de una misma OP devolvía también lo que la 1ª ya había
  // devuelto y el rollo quedaba con tela de más (pasó con ZAT-TOP-NG-002 sobre R-0025).
  // `permitirTerminada` queda en false: revertir suelto una orden terminada la dejaría sin ficha.
  try {
    await prisma.$transaction((tx) => revertirCorteOrden(tx, id, session), { timeout: 30000, maxWait: 15000 });
  } catch (e) {
    if (e instanceof CorteError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  return NextResponse.json({ ok: true });
}
