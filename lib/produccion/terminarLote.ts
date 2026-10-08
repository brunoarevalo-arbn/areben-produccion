import type { Prisma, PrismaClient } from '@prisma/client';
import { partesDeOrden, skuDeParte } from './conjuntos';
import { baseDeRepartoConOrigen, tallesCortados } from './cantidades';
import { estadoDeLotes, lotesParaPantalla } from './lotesPlanificados';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Lo que necesita el formulario de "Terminar / Ingresar" de un LoteProduccion: los colores
 * en COSTURA con su base, talles, piezas y lotes planificados. Lo usan la página
 * `/produccion/lote/[loteId]/terminar` y el tablero (ventana sobre la pantalla).
 * `ordenId` limita a un solo color.
 *
 * 🔴 Los talles salen de `tallesCortados()`, no sólo de `cortes_por_talle`: la carga del
 * cortador escribe únicamente el JSON de la ficha, y leyendo sólo la tabla un corte de 62
 * aparecía sin talles.
 */
export async function datosTerminarLote(db: Db, loteId: string, ordenId?: string) {
  const lote = await db.loteProduccion.findUnique({
    where: { id: loteId },
    include: {
      ordenes: {
        where: { estado: 'COSTURA', ...(ordenId ? { id: ordenId } : {}) },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, sku: true, descripcion: true, cantidad: true, cantidadCortada: true, fichaCorteData: true,
          cortesPorTalle: { orderBy: { talle: 'asc' }, select: { talle: true, cantidad: true } },
        },
      },
    },
  });
  if (!lote) return null;

  // 🔴 El número de referencia es lo CORTADO, y el rótulo tiene que decir cuál de los dos
  // es: `baseDeRepartoConOrigen` es el mismo dueño que usa el reparto del costo.
  const ordenes = await Promise.all(lote.ordenes.map(async (o) => ({
    id: o.id,
    sku: o.sku,
    descripcion: o.descripcion,
    base: baseDeRepartoConOrigen(o),
    cortes: tallesCortados(o) ?? [],
    // Una prenda por partes (la bikini) se cuenta por pieza y cada una entra a su SKU.
    partes: (await partesDeOrden(db, o.sku)).map((p) => ({ nombre: p.nombre, sku: skuDeParte(o.sku, p.skuAbrev) })),
    // Separada en lotes: el color dice en cuál entra, y se precarga lo que le falta a ése.
    lotes: lotesParaPantalla(await estadoDeLotes(db, o)),
  })));

  return { id: lote.id, titulo: lote.descripcion || lote.prenda || 'Lote', marca: lote.marca, ordenes };
}
