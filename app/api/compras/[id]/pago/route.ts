import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireInsumos } from '@/lib/auth';
import { PagoSchema } from '@/lib/validators/insumos';
import { resolverPago } from '@/lib/pagos';
import { Prisma } from '@prisma/client';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await requireInsumos(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = PagoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const actual = await prisma.compra.findUnique({ where: { id }, select: { totalBruto: true } });
  if (!actual) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });
  // El estado se deriva del monto vs el total (no se confía en el del cliente).
  const pago = resolverPago(Number(actual.totalBruto), parsed.data.montoPagado);

  const compra = await prisma.compra.update({
    where: { id },
    data: {
      estadoPago:  pago.estadoPago,
      montoPagado: new Prisma.Decimal(pago.montoPagado),
      fechaPago:   parsed.data.fechaPago ? new Date(parsed.data.fechaPago) : null,
    },
  });

  return NextResponse.json(compra);
}
