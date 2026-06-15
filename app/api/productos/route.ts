import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ProductoSchema } from '@/lib/validators/diseno';
import { ZodError } from 'zod';
import { requirePermiso } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const marca    = searchParams.get('marca') ?? undefined;
    const estado   = searchParams.get('estado') ?? undefined;
    const temporada = searchParams.get('temporada') ?? undefined;

    const productos = await prisma.producto.findMany({
      where: {
        ...(marca     ? { marca }     : {}),
        ...(estado    ? { estado }    : {}),
        ...(temporada ? { temporada } : {}),
      },
      include: { fotos: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(productos);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error obteniendo productos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  try {
    const body      = await req.json();
    const validated = ProductoSchema.parse(body);

    const costoTotal = validated.costoTela + validated.costoMO;

    const producto = await prisma.producto.create({
      data: { ...validated, costoTotal },
      include: { fotos: true },
    });

    return NextResponse.json(producto, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error creando producto' }, { status: 500 });
  }
}
