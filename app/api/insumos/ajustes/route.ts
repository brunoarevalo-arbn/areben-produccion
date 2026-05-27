import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireInsumos } from '@/lib/auth';
import { AjusteSchema } from '@/lib/validators/insumos';
import { Prisma } from '@prisma/client';

export async function POST(req: NextRequest) {
  const session = await requireInsumos(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const body = await req.json();
  const parsed = AjusteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { tipo, targetId, cantidad, motivo } = parsed.data;
  const cantidadDecimal = new Prisma.Decimal(cantidad);

  if (tipo === 'rollo') {
    const rollo = await prisma.rollo.findUnique({ where: { id: targetId } });
    if (!rollo) return NextResponse.json({ error: 'Rollo no encontrado' }, { status: 404 });

    const nuevoPeso = rollo.pesoActual.add(cantidadDecimal);
    if (nuevoPeso.lessThan(0)) {
      return NextResponse.json({ error: 'El ajuste dejaría el rollo con peso negativo' }, { status: 400 });
    }

    const nuevoEstado = nuevoPeso.equals(0) ? 'AGOTADO' as const
      : nuevoPeso.lessThan(rollo.pesoInicial) ? 'EN_USO_PARCIAL' as const
      : 'DISPONIBLE' as const;

    const tipoMov = cantidad < 0 ? 'DESCARTE' as const : 'AJUSTE' as const;

    const [movimiento] = await prisma.$transaction([
      prisma.movimientoInsumo.create({
        data: {
          tipo: tipoMov,
          rolloId: targetId,
          cantidad: cantidadDecimal,
          motivo,
          usuarioId: session.id,
        },
      }),
      prisma.rollo.update({
        where: { id: targetId },
        data: { pesoActual: nuevoPeso, estado: nuevoEstado },
      }),
    ]);

    return NextResponse.json(movimiento, { status: 201 });
  }

  // tipo === 'lote'
  const lote = await prisma.lote.findUnique({ where: { id: targetId } });
  if (!lote) return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 });

  const nuevaCantidad = lote.cantidadActual.add(cantidadDecimal);
  if (nuevaCantidad.lessThan(0)) {
    return NextResponse.json({ error: 'El ajuste dejaría el lote con cantidad negativa' }, { status: 400 });
  }

  const nuevoEstado = nuevaCantidad.equals(0) ? 'AGOTADO' as const
    : nuevaCantidad.lessThan(lote.cantidadInicial) ? 'EN_USO_PARCIAL' as const
    : 'DISPONIBLE' as const;

  const tipoMov = cantidad < 0 ? 'DESCARTE' as const : 'AJUSTE' as const;

  const [movimiento] = await prisma.$transaction([
    prisma.movimientoInsumo.create({
      data: {
        tipo: tipoMov,
        loteId: targetId,
        cantidad: cantidadDecimal,
        motivo,
        usuarioId: session.id,
      },
    }),
    prisma.lote.update({
      where: { id: targetId },
      data: { cantidadActual: nuevaCantidad, estado: nuevoEstado },
    }),
  ]);

  return NextResponse.json(movimiento, { status: 201 });
}
