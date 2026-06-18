import { prisma } from '@/lib/prisma';
import { parseDatos } from './escandallo';

// Fallback del descuento de avíos vía escandallo.
// Si una orden ya está terminada pero todavía no se descontaron sus avíos
// (porque al terminar no había receta — ni en el corte ni en escandallo),
// al guardar el escandallo de ese SKU se aplica el descuento acá. Guardado por
// OrdenProduccion.aviosDescontados → nunca descuenta dos veces.
export async function aplicarDescuentoAviosDesdeEscandallo(
  sku: string | null | undefined,
  datosRaw: unknown,
) {
  if (!sku?.trim()) return;
  const datos = parseDatos(typeof datosRaw === 'string' ? datosRaw : JSON.stringify(datosRaw ?? null));

  const refs: { etiquetaId: string; cantidad: number }[] = [];
  if (datos.avios.etiquetaPrincipalId)   refs.push({ etiquetaId: datos.avios.etiquetaPrincipalId,   cantidad: 1 });
  if (datos.avios.etiquetaComposicionId) refs.push({ etiquetaId: datos.avios.etiquetaComposicionId, cantidad: 1 });
  if (refs.length === 0) return;

  const ops = await prisma.ordenProduccion.findMany({
    where: { sku: sku.trim(), terminadoAt: { not: null }, aviosDescontados: false },
  });

  for (const op of ops) {
    // Si la orden tiene avíos cargados del corte, esos mandan (se descuentan al
    // terminar). El escandallo solo cubre las que quedaron sin receta.
    const tieneCorte = await prisma.ordenAvio.count({ where: { ordenId: op.id } });
    if (tieneCorte > 0) continue;

    await prisma.$transaction(async (tx) => {
      for (const a of refs) {
        const et = await tx.etiquetaCatalogo.findUnique({ where: { id: a.etiquetaId } });
        if (!et || et.stock == null) continue;
        await tx.etiquetaCatalogo.update({
          where: { id: a.etiquetaId },
          data: { stock: Math.max(0, et.stock - a.cantidad * op.cantidad) },
        });
      }
      await tx.ordenProduccion.update({ where: { id: op.id }, data: { aviosDescontados: true } });
    });
  }
}
