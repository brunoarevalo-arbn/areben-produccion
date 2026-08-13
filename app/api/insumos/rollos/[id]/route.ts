import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAlguno, requireInsumos } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  // Ficha completa del rollo: costo + historial de movimientos. Solo Inventario y
  // Producción; el permiso chico `muestras` no llega hasta acá.
  const session = await requireAlguno(req, ['insumos', 'produccion']);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const rollo = await prisma.rollo.findUnique({
    where: { id },
    include: {
      insumo: { select: { nombre: true, categoria: true, unidadDefault: true, rinde: true, anchoCm: true, tubular: true } },
      color: { select: { id: true, nombre: true, abreviatura: true } },
      compra: { select: { id: true, fecha: true, numeroFactura: true, proveedor: { select: { nombre: true } } } },
      movimientos: {
        orderBy: { fecha: 'desc' },
      },
    },
  });

  if (!rollo) return NextResponse.json({ error: 'Rollo no encontrado' }, { status: 404 });
  return NextResponse.json(rollo);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await requireInsumos(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.colorId !== undefined) data.colorId = body.colorId || null;
  if (body.costoUnitario !== undefined) {
    const c = Number(body.costoUnitario);
    if (!isFinite(c) || c < 0) return NextResponse.json({ error: 'Costo inválido' }, { status: 400 });
    data.costoUnitario = new Prisma.Decimal(c);
  }
  // Ancho medido de ESTE rollo. `null` lo vuelve a "sin medir" y manda otra vez el
  // ancho del artículo; sin esto no habría forma de deshacer un ancho mal cargado.
  if (body.anchoCm !== undefined) {
    if (body.anchoCm === null || body.anchoCm === '') {
      data.anchoCm = null;
    } else {
      const a = Number(body.anchoCm);
      if (!isFinite(a) || a <= 0) return NextResponse.json({ error: 'Ancho inválido' }, { status: 400 });
      data.anchoCm = new Prisma.Decimal(a);
    }
  }

  const rollo = await prisma.rollo.update({ where: { id }, data });
  return NextResponse.json(rollo);
}
