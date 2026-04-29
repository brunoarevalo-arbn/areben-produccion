import { NextRequest, NextResponse } from 'next/server';
import { TiempoSchema } from '@/lib/validators/tiempos';
import { prisma } from '@/lib/prisma';
import { ZodError } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const usuario = searchParams.get('usuario');
    const fecha = searchParams.get('fecha');

    if (!usuario) {
      return NextResponse.json({ error: 'Usuario requerido' }, { status: 400 });
    }

    const tiempos = await prisma.tiemposProduccion.findMany({
      where: {
        usuario,
        ...(fecha ? { fecha } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(tiempos);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Error fetching tiempos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = TiempoSchema.parse(body);

    const tiempo = await prisma.tiemposProduccion.create({
      data: validated,
    });

    return NextResponse.json(tiempo, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error:', error);
    return NextResponse.json({ error: 'Error creating tiempo' }, { status: 500 });
  }
}
