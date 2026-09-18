import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { conjuntosActivos, partesDeSku } from '@/lib/produccion/conjuntos';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [ordenes, conjuntos] = await Promise.all([
      prisma.ordenProduccion.findMany({
        // La tablet de costura solo muestra órdenes en costura, y sin el aviso de
        // "ya terminé": ésas salen de la cola aunque el estado no se haya movido (el
        // conteo por talle y el ingreso a stock los hace el taller).
        where: { estado: 'COSTURA', avisoCosturaAt: null },
        orderBy: [{ createdAt: 'asc' }],
        select: { id: true, sku: true, descripcion: true, marca: true, cantidad: true, cantidadCortada: true, estado: true },
      }),
      conjuntosActivos(),
    ]);

    // Las PARTES viajan con la orden para que la tablet no tenga que preguntar de
    // nuevo: una prenda de una sola parte devuelve [] y la pantalla no cambia.
    return NextResponse.json(
      ordenes.map((o) => ({ ...o, partes: partesDeSku(o.sku, conjuntos) })),
    );
  } catch (err) {
    console.error('[tiempos/cola GET]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
