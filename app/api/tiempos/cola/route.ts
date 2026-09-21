import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { conjuntosActivos, partesDeSku, nombresDePartes } from '@/lib/produccion/conjuntos';

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
    //
    // 🔴 Van sólo los NOMBRES (`nombresDePartes`), que es lo que la tablet dibuja.
    // `partesDeSku` devuelve `ParteDePrenda` —un objeto con `skuAbrev` y
    // `porcentajeMaterial`, que la tablet ⛔ no usa— desde que el lote entra por
    // pieza (18-sep, aa8ed5a), y mandarlo entero rompió la tablet EN PRODUCCIÓN:
    // React no sabe dibujar un objeto y el error #31 se lleva la pantalla ENTERA
    // ("This page couldn't load") al tocar el SKU de la bikini. ⚠️ `tsc` ⛔ no lo
    // caza: acá se serializa a JSON y del otro lado el cliente lo vuelve a tipear
    // como `string[]` a mano, así que el contrato entre las dos puntas ⛔ no existe
    // para el compilador. Si la tablet algún día necesita el SKU de la pieza, se
    // manda un campo NUEVO: lo que se dibuja se manda ya listo para dibujar.
    return NextResponse.json(
      ordenes.map((o) => ({ ...o, partes: nombresDePartes(partesDeSku(o.sku, conjuntos)) })),
    );
  } catch (err) {
    console.error('[tiempos/cola GET]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
