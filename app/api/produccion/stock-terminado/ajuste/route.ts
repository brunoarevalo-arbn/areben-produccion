import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { AjusteTerminadoSchema } from '@/lib/validators/produccion';

// Ajuste manual del stock de producto terminado: carga inicial, merma, corrección.
// cantidad > 0 suma, cantidad < 0 descuenta. Registra MovimientoTerminado origen 'ajuste'.
export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const parsed = AjusteTerminadoSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { sku, talle, tipo, cantidad, motivo } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const actual = await tx.stockTerminado.findUnique({
      where: { sku_talle_tipo: { sku, talle, tipo } },
    });
    const nuevo = (actual?.cantidad ?? 0) + cantidad;
    if (nuevo < 0) {
      throw new Error(`El ajuste deja stock negativo (actual ${actual?.cantidad ?? 0}, ajuste ${cantidad})`);
    }

    await tx.stockTerminado.upsert({
      where:  { sku_talle_tipo: { sku, talle, tipo } },
      create: { sku, talle, tipo, cantidad: nuevo },
      update: { cantidad: nuevo },
    });
    await tx.movimientoTerminado.create({
      data: {
        sku, talle, tipo, cantidad,
        origen: 'ajuste',
        motivo: motivo?.trim() || 'Ajuste manual',
        creadoPor: session.nombre,
      },
    });
    return nuevo;
  }).catch((e: Error) => ({ error: e.message }));

  if (typeof result === 'object' && result && 'error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, cantidad: result }, { status: 201 });
}
