import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ProductoSchema } from '@/lib/validators/diseno';
import { ZodError } from 'zod';
import { requirePermiso } from '@/lib/auth';

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const producto = await prisma.producto.findUnique({
      where: { id },
      include: {
        fotos:    { orderBy: { createdAt: 'asc' } },
        historial: { orderBy: { version: 'desc' } },
      },
    });

    if (!producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    return NextResponse.json(producto);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error obteniendo producto' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Context) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  try {
    const { id }    = await params;
    const body      = await req.json();
    const validated = ProductoSchema.partial().parse(body);

    const costoTotal =
      validated.costoTela !== undefined || validated.costoMO !== undefined
        ? (validated.costoTela ?? 0) + (validated.costoMO ?? 0)
        : undefined;

    const existing = await prisma.producto.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    await prisma.historialDiseno.create({
      data: {
        productoId: id,
        version:    (await prisma.historialDiseno.count({ where: { productoId: id } })) + 1,
        cambios:    body.cambios ?? 'Actualización',
        snapshot:   JSON.stringify(existing),
        creadoPor:  body.creadoPor ?? 'sistema',
      },
    });

    const producto = await prisma.producto.update({
      where: { id },
      data: { ...validated, ...(costoTotal !== undefined ? { costoTotal } : {}) },
      include: { fotos: true, historial: { orderBy: { version: 'desc' } } },
    });

    return NextResponse.json(producto);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error actualizando producto' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Context) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  try {
    const { id } = await params;

    const existing = await prisma.producto.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    await prisma.producto.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error eliminando producto' }, { status: 500 });
  }
}
