import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { conjuntosActivos, partesDeSku, nombresDePartes } from '@/lib/produccion/conjuntos';
import { lotesParaTablet } from '@/lib/produccion/lotesPlanificados';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [ordenes, conjuntos] = await Promise.all([
      prisma.ordenProduccion.findMany({
        // La tablet de costura solo muestra órdenes en costura, y sin el aviso de
        // "ya terminé": ésas salen de la cola aunque el estado no se haya movido (el
        // conteo por talle y el ingreso a stock los hace el taller).
        // Tampoco las que el taller puso EN ESPERA ("falta dije"): se guardaron para después.
        where: { estado: 'COSTURA', avisoCosturaAt: null, enEsperaDesde: null },
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
    //
    // Los LOTES van igual, ya listos para usar y ⛔ nunca el lote entero: una orden
    // separada sale UNA VEZ POR CADA LOTE VISIBLE (`lote: 1`, `lote: 2`) y la costurera toca
    // la bolsa que tiene; `confirmarDespuesDe` es el proceso que, al terminar, activa una
    // separación programada. Una orden sin separar sale una vez, con los dos en null.
    // Una separada con todos los lotes ocultos no sale: no es algo que tenga en la mesa.
    const lotes = await lotesParaTablet(prisma, ordenes);
    type Fila = (typeof ordenes)[number] & { partes: string[]; lote: number | null; confirmarDespuesDe: string | null };
    const filas = ordenes.flatMap((o): Fila[] => {
      const base = { ...o, partes: nombresDePartes(partesDeSku(o.sku, conjuntos)) };
      const l = lotes.get(o.id);
      if (!l) return [{ ...base, lote: null, confirmarDespuesDe: null }];
      if (l.confirmarDespuesDe) return [{ ...base, lote: null, confirmarDespuesDe: l.confirmarDespuesDe }];
      return l.lotes.map((n) => ({ ...base, lote: n, confirmarDespuesDe: null }));
    });
    return NextResponse.json(filas);
  } catch (err) {
    console.error('[tiempos/cola GET]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
