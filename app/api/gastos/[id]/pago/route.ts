import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { PagoSchema } from '@/lib/validators/insumos';
import { resolverPago } from '@/lib/pagos';
import { Prisma } from '@prisma/client';

type Ctx = { params: Promise<{ id: string }> };

// Registrar/actualizar el pago de un gasto-compra. Espejo de /api/compras/[id]/pago.
export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'gastos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const parsed = PagoSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { fechaPago } = parsed.data;

  const actual = await prisma.gasto.findUnique({ where: { id }, select: { monto: true } });
  if (!actual) return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });
  // El estado se deriva del monto vs el total (no se confía en el del cliente).
  const pago = resolverPago(actual.monto, parsed.data.montoPagado);

  const gasto = await prisma.gasto.update({
    where: { id },
    data: { estadoPago: pago.estadoPago, montoPagado: new Prisma.Decimal(pago.montoPagado), fechaPago: fechaPago || null },
  });
  return NextResponse.json(gasto);
}
