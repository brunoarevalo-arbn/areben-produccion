import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ordenes = await prisma.ordenProduccion.findMany({
      // La tablet de costura solo muestra órdenes en costura, y sin el aviso de
      // "ya terminé": ésas salen de la cola aunque el estado no se haya movido (el
      // conteo por talle y el ingreso a stock los hace el taller).
      where: { estado: 'COSTURA', avisoCosturaAt: null },
      orderBy: [{ createdAt: 'asc' }],
      select: { id: true, sku: true, descripcion: true, marca: true, cantidad: true, cantidadCortada: true, estado: true },
    });
    return NextResponse.json(ordenes);
  } catch (err) {
    console.error('[tiempos/cola GET]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
