import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ordenes = await prisma.ordenProduccion.findMany({
      where: { estado: { notIn: ['CERRADA'] } },
      orderBy: [{ estado: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, sku: true, descripcion: true, marca: true, cantidad: true, estado: true },
    });
    return NextResponse.json(ordenes);
  } catch (err) {
    console.error('[tiempos/cola GET]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
