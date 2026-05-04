import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { estado } = await req.json();

    const ESTADOS_VALIDOS = ['pendiente', 'en_produccion', 'terminado'];
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
    }

    const data: Record<string, unknown> = { estado };
    if (estado === 'terminado') data.terminadoAt = new Date();
    else data.terminadoAt = null;

    const orden = await prisma.ordenProduccion.update({ where: { id }, data });
    return NextResponse.json(orden);
  } catch (err) {
    console.error('[tiempos/cola PATCH]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
