import type { Prisma } from '@prisma/client';
import type { SessionPayload } from '@/lib/session';
import { parseDatos } from '@/lib/costos/escandallo';

export class CosturaError extends Error {}

export interface TalleConteo { talle: string; cantidad: number; }

/**
 * Termina la costura de UNA orden dentro de una transacción: cuenta lo que salió
 * por talle → ingresa al stock de lisos terminados, descuenta los avíos una sola
 * vez (receta del corte o, si está vacía, fallback al escandallo del SKU) y pasa la
 * OP a TERMINADO_SIN_ESTAMPA. Lanza CosturaError ante validaciones.
 *
 * Se usa tanto en el terminar por orden (cola/[id]/terminar) como en el terminar
 * por lote (lote/[loteId]/terminar), que la invoca una vez por color en la misma tx.
 */
export async function terminarCosturaOrden(
  tx: Prisma.TransactionClient,
  ordenId: string,
  tallesInput: TalleConteo[],
  session: SessionPayload,
): Promise<number> {
  const orden = await tx.ordenProduccion.findUnique({ where: { id: ordenId } });
  if (!orden) throw new CosturaError('OP no encontrada');
  if (orden.estado !== 'COSTURA') throw new CosturaError(`La OP ${orden.sku ?? ordenId} no está en costura`);
  if (!orden.sku?.trim()) throw new CosturaError('La OP no tiene SKU asignado');

  const sku = orden.sku.trim();
  const talles = tallesInput.filter((t) => t.cantidad > 0);
  if (talles.length === 0) throw new CosturaError(`Cargá la cantidad que salió de al menos un talle (${sku})`);
  const totalProducido = talles.reduce((s, t) => s + t.cantidad, 0);

  for (const t of talles) {
    await tx.stockTerminado.upsert({
      where:  { sku_talle_tipo: { sku, talle: t.talle, tipo: 'liso' } },
      create: { sku, talle: t.talle, tipo: 'liso', cantidad: t.cantidad },
      update: { cantidad: { increment: t.cantidad } },
    });
    await tx.movimientoTerminado.create({
      data: {
        sku, talle: t.talle, tipo: 'liso',
        cantidad: t.cantidad,
        origen: 'produccion',
        ordenId,
        motivo: 'Costura terminada',
        creadoPor: session.nombre,
      },
    });
  }

  // Descontar avíos del stock — una sola vez por orden (guard aviosDescontados).
  // Receta: lo cargado en el corte; si está vacío, fallback al escandallo del SKU.
  let descontado = false;
  if (!orden.aviosDescontados) {
    const receta: { etiquetaId: string; cantidad: number }[] =
      (await tx.ordenAvio.findMany({ where: { ordenId } }))
        .map((a) => ({ etiquetaId: a.etiquetaId, cantidad: a.cantidad }));

    if (receta.length === 0) {
      const escandallo = await tx.escandallo.findFirst({ where: { sku } });
      if (escandallo) {
        const datos = parseDatos(escandallo.datos);
        if (datos.avios.etiquetaPrincipalId)   receta.push({ etiquetaId: datos.avios.etiquetaPrincipalId,   cantidad: 1 });
        if (datos.avios.etiquetaComposicionId) receta.push({ etiquetaId: datos.avios.etiquetaComposicionId, cantidad: 1 });
      }
    }

    // 🔴 Antes esto descontaba con `Math.max(0, stock - consumido)`: si el avío no
    // alcanzaba, el stock quedaba en 0, el faltante se perdía y NADA lo decía. La tela sí
    // se planta cuando los kg no alcanzan (`registrarCorteOrden`); los avíos no lo hacían.
    // Ahora se juntan TODOS los faltantes y se nombra cada uno: plantarse en el primero
    // obligaría a descubrirlos de a uno.
    const aDescontar: { etiquetaId: string; nombre: string; consumido: number; stock: number }[] = [];
    const faltantes: string[] = [];
    for (const a of receta) {
      const et = await tx.etiquetaCatalogo.findUnique({ where: { id: a.etiquetaId } });
      if (!et || et.stock == null) continue; // sin seguimiento / ilimitado
      const consumido = a.cantidad * totalProducido;
      if (consumido > et.stock) {
        faltantes.push(`${et.nombre}: hacen falta ${consumido} y hay ${et.stock} (faltan ${consumido - et.stock})`);
        continue;
      }
      aDescontar.push({ etiquetaId: a.etiquetaId, nombre: et.nombre, consumido, stock: et.stock });
    }
    if (faltantes.length > 0) {
      throw new CosturaError(
        `No alcanza el stock de avíos para ingresar ${totalProducido} u de ${sku} — ${faltantes.join(' · ')}. ` +
        'Ajustá el stock del avío o cargá la compra antes de ingresar.',
      );
    }

    for (const a of aDescontar) {
      await tx.etiquetaCatalogo.update({ where: { id: a.etiquetaId }, data: { stock: a.stock - a.consumido } });
      await tx.avioMovimiento.create({
        data: {
          etiquetaId: a.etiquetaId, tipo: 'EGRESO', cantidad: -a.consumido, ordenId,
          motivo: `Consumo producción${sku ? ` ${sku}` : ''}`, creadoPor: session.nombre,
        },
      });
    }
    descontado = receta.length > 0;
  }

  await tx.ordenProduccion.update({
    where: { id: ordenId },
    data: {
      // `cantidad` NO se toca: es lo planificado. Lo producido se deriva de los
      // MovimientoTerminado de la orden (`cantidadIngresada` en lib/produccion/cantidades.ts).
      estado: 'TERMINADO_SIN_ESTAMPA', terminadoAt: new Date(),
      // El aviso de la tablet ya cumplió: el taller contó e ingresó.
      avisoCosturaAt: null, avisoCosturaPor: null,
      ...(descontado ? { aviosDescontados: true } : {}),
    },
  });
  await tx.estadoTransicion.create({
    data: {
      ordenId,
      estadoAnterior: 'COSTURA',
      estadoNuevo: 'TERMINADO_SIN_ESTAMPA',
      usuarioId: session.id,
      notas: `Costura terminada: ${totalProducido} u (${talles.map((t) => `${t.talle}:${t.cantidad}`).join(', ')}) → stock`,
    },
  });

  return totalProducido;
}
