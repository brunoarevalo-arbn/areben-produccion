import type { Prisma, PrismaClient } from '@prisma/client';
import { parseDatos } from '@/lib/costos/escandallo';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Un avío de la receta de una orden, con lo que hace falta para descontarlo y costearlo.
 * `cantidad` es POR PIEZA (en una prenda que no se parte, por prenda). `parte` es la del
 * catálogo: `null` = va en todas las piezas; `'Bombacha'` = va sólo en esa.
 */
export interface AvioDeReceta {
  etiquetaId: string;
  nombre: string;
  cantidad: number;
  precio: number;
  stock: number | null;
  parte: string | null;
}

/**
 * La receta de avíos de una orden: lo cargado en el corte y, si está vacío, el fallback a
 * las dos etiquetas del escandallo del SKU. Es la MISMA receta para descontar stock y para
 * costear el lote: si fueran dos, una pantalla diría que el dije se consumió y el costo no
 * lo tendría (pasó hasta el 19-oct: los avíos sólo movían stock).
 */
export async function recetaDeAvios(db: Db, ordenId: string, sku: string | null): Promise<AvioDeReceta[]> {
  const delCorte = await db.ordenAvio.findMany({ where: { ordenId }, include: { etiqueta: true } });
  if (delCorte.length > 0) {
    return delCorte.map((a) => ({
      etiquetaId: a.etiquetaId, nombre: a.etiqueta.nombre, cantidad: a.cantidad,
      precio: Number(a.etiqueta.precio) || 0, stock: a.etiqueta.stock, parte: a.etiqueta.parte,
    }));
  }

  const escandallo = sku?.trim() ? await db.escandallo.findFirst({ where: { sku: sku.trim() } }) : null;
  if (!escandallo) return [];
  const datos = parseDatos(escandallo.datos);
  const ids = [datos.avios.etiquetaPrincipalId, datos.avios.etiquetaComposicionId].filter((x): x is string => !!x);
  const etiquetas = await db.etiquetaCatalogo.findMany({ where: { id: { in: ids } } });
  return ids.flatMap((id) => {
    const et = etiquetas.find((e) => e.id === id);
    return et ? [{ etiquetaId: et.id, nombre: et.nombre, cantidad: 1, precio: Number(et.precio) || 0, stock: et.stock, parte: et.parte }] : [];
  });
}

/**
 * Cuántos lleva UNA unidad de `parte`. `parte = null` es una prenda que no se parte: ahí la
 * pieza del catálogo no aplica (el dije de la bikini usado en otra prenda va entero).
 */
export function porPieza(a: AvioDeReceta, parte: string | null): number {
  if (parte === null) return a.cantidad;
  return !a.parte || a.parte === parte ? a.cantidad : 0;
}

/** Cuántos lleva la prenda ENTERA: en una bikini, el satén va 2 veces y el dije 1. */
export function porPrenda(a: AvioDeReceta, partes: string[]): number {
  if (partes.length === 0) return a.cantidad;
  return partes.reduce((s, p) => s + porPieza(a, p), 0);
}

/** $ de avíos de una unidad de `parte` (null = prenda que no se parte). */
export function costoAviosDePieza(receta: AvioDeReceta[], parte: string | null): number {
  return receta.reduce((s, a) => s + a.precio * porPieza(a, parte), 0);
}

/** $ de avíos de la prenda entera. */
export function costoAviosDePrenda(receta: AvioDeReceta[], partes: string[]): number {
  return receta.reduce((s, a) => s + a.precio * porPrenda(a, partes), 0);
}

/**
 * 🔴 Un avío marcado para una pieza que esta prenda NO tiene no iría en ninguna: ni se
 * descontaría ni se costearía, y nada lo diría. Devuelve los que están así.
 */
export function aviosFueraDeLasPartes(receta: AvioDeReceta[], partes: string[]): AvioDeReceta[] {
  if (partes.length === 0) return [];
  return receta.filter((a) => a.parte && !partes.includes(a.parte));
}
