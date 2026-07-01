import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requirePermiso } from '@/lib/auth';
import { RegistrarCorteSchema } from '@/lib/validators/produccion';
import { registrarCorteOrden, revertirCorteOrden, CorteError } from '@/lib/produccion/corte';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const orden = await prisma.ordenProduccion.findUnique({
    where: { id },
    include: {
      cortesPorTalle: { orderBy: { talle: 'asc' } },
      avios: { select: { etiquetaId: true, cantidad: true } },
      movimientosInsumo: {
        include: {
          rollo: { include: { insumo: { select: { nombre: true, rinde: true } }, color: { select: { nombre: true } } } },
          lote: { include: { insumo: { select: { nombre: true } }, color: { select: { nombre: true } } } },
        },
        orderBy: { fecha: 'desc' },
      },
    },
  });

  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });
  return NextResponse.json(orden);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const parsed = RegistrarCorteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    // Si la ficha ya estaba cargada, es una EDICIÓN: revierte y re-registra en la misma
    // transacción (el impacto neto en rollos es la diferencia). Nada se toca si algo falla.
    const result = await prisma.$transaction(async (tx) => {
      await revertirCorteOrden(tx, id, session);
      return registrarCorteOrden(tx, id, parsed.data, session);
    }, { timeout: 30000, maxWait: 15000 });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof CorteError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
