import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MovimientoSchema } from '@/lib/validators/stock';
import { ZodError } from 'zod';

export async function GET() {
  try {
    const stock = await prisma.stock.findMany({
      include: { producto: { select: { id: true, nombre: true, marca: true, temporada: true } } },
      orderBy: { producto: { nombre: 'asc' } },
    });
    return NextResponse.json(stock);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error obteniendo stock' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body      = await req.json();
    const validated = MovimientoSchema.parse(body);

    const movimiento = await prisma.$transaction(async (tx) => {
      const mov = await tx.movimientoStock.create({ data: validated });

      let stock = await tx.stock.findUnique({ where: { productoId: validated.productoId } });
      if (!stock) {
        stock = await tx.stock.create({
          data: { productoId: validated.productoId, cantidadDeposito: 0, cantidadLocal: 0 },
        });
      }

      const delta = validated.cantidad;
      const updates: Record<string, number> = {};

      if (validated.tipo === 'entrada_deposito') updates.cantidadDeposito = stock.cantidadDeposito + delta;
      if (validated.tipo === 'salida_deposito')  updates.cantidadDeposito = Math.max(0, stock.cantidadDeposito - delta);
      if (validated.tipo === 'entrada_local')    updates.cantidadLocal    = stock.cantidadLocal    + delta;
      if (validated.tipo === 'venta')            updates.cantidadLocal    = Math.max(0, stock.cantidadLocal    - delta);

      const stockActualizado = await tx.stock.update({
        where: { productoId: validated.productoId },
        data: updates,
        include: { producto: { select: { nombre: true } } },
      });

      return { movimiento: mov, stock: stockActualizado };
    });

    return NextResponse.json(movimiento, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error registrando movimiento' }, { status: 500 });
  }
}
