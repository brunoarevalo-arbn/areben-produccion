import { Prisma } from '@prisma/client';
import type { SessionPayload } from '@/lib/session';
import type { z } from 'zod';
import type { RegistrarCorteSchema } from '@/lib/validators/produccion';

export type CorteOrdenData = z.infer<typeof RegistrarCorteSchema>;

/**
 * Error de negocio del corte: el endpoint lo traduce a un 400 con su mensaje.
 */
export class CorteError extends Error {}

/**
 * Registra la ficha de corte de UNA orden dentro de una transacción dada:
 * valida rollos/rinde/stock, descuenta tela (movimientos CONSUMO), crea los
 * cortes por talle y los avíos, y actualiza la OP (fichaCorteCargada, costos,
 * cantidad). Lanza CorteError con mensaje legible ante cualquier validación.
 *
 * Se usa tanto en el corte por orden (cola/[id]/corte) como en el corte por
 * lote (lote/[loteId]/corte), que la invoca una vez por color en la misma tx.
 * Los lookups van contra `tx` para que el consumo secuencial vea pesos ya
 * decrementados (correcto aún si dos colores compartieran un rollo).
 */
export async function registrarCorteOrden(
  tx: Prisma.TransactionClient,
  ordenId: string,
  data: CorteOrdenData,
  session: SessionPayload,
) {
  const orden = await tx.ordenProduccion.findUnique({ where: { id: ordenId } });
  if (!orden) throw new CorteError('OP no encontrada');

  // La ficha es diferida: se puede cargar en cualquier estado del flujo. Para corregirla,
  // se revierte (endpoint /revertir) y se vuelve a cargar — así se devuelve el stock consumido.
  if (orden.fichaCorteCargada) {
    throw new CorteError('La ficha ya fue cargada. Para corregirla, revertí el corte y volvé a cargarla.');
  }

  const { consumoRollos, cortesPorTalle, avios, cortadorId, costoCorte, fichaFotoUrl, notas, fichaData, fechaCorte } = data;

  // Buscar cortador para guardar denormalizado
  let cortadorNombre: string | null = null;
  if (cortadorId) {
    const c = await tx.cortador.findUnique({ where: { id: cortadorId } });
    if (!c) throw new CorteError('Cortador no encontrado');
    cortadorNombre = c.nombre;
  }

  // Validar rollos y rinde
  const rolloIds = consumoRollos.map((c) => c.rolloId);
  const rollos = await tx.rollo.findMany({
    where: { id: { in: rolloIds } },
    include: { insumo: { select: { rinde: true, nombre: true } } },
  });
  const rollosMap = new Map(rollos.map((r) => [r.id, r]));

  for (const cr of consumoRollos) {
    const rollo = rollosMap.get(cr.rolloId);
    if (!rollo) throw new CorteError(`Rollo ${cr.rolloId} no encontrado`);
    if (!rollo.insumo.rinde || Number(rollo.insumo.rinde) <= 0) {
      throw new CorteError(`Insumo "${rollo.insumo.nombre}" no tiene rinde cargado`);
    }
    const kgNecesarios = cr.metrosUsados / Number(rollo.insumo.rinde);
    if (kgNecesarios > Number(rollo.pesoActual)) {
      throw new CorteError(`Rollo ${rollo.codigo}: ${cr.metrosUsados}m = ${kgNecesarios.toFixed(2)}kg, solo tiene ${rollo.pesoActual}kg`);
    }
  }

  // Validar talles unicos
  const tallesSet = new Set<string>();
  for (const t of cortesPorTalle) {
    if (tallesSet.has(t.talle)) throw new CorteError(`Talle duplicado: ${t.talle}`);
    tallesSet.add(t.talle);
  }

  // Calcular costos
  let costoTela = new Prisma.Decimal(0);
  for (const cr of consumoRollos) {
    const rollo = rollosMap.get(cr.rolloId)!;
    const rinde = Number(rollo.insumo.rinde);
    const kgConsumidos = new Prisma.Decimal(cr.metrosUsados).div(new Prisma.Decimal(rinde));
    costoTela = costoTela.add(kgConsumidos.mul(rollo.costoUnitario));
  }

  // Cantidad total cortada = suma de talles → reemplaza la cantidad planificada
  const cantidadTotal = cortesPorTalle.reduce((s, t) => s + t.cantidad, 0);

  // Descontar rollos (kg = metros / rinde)
  for (const cr of consumoRollos) {
    const rollo = rollosMap.get(cr.rolloId)!;
    const rinde = Number(rollo.insumo.rinde);
    const kgConsumidos = new Prisma.Decimal(cr.metrosUsados).div(new Prisma.Decimal(rinde));
    const nuevoPeso = rollo.pesoActual.sub(kgConsumidos);
    const nuevoEstado = nuevoPeso.lte(new Prisma.Decimal('0.01')) ? 'AGOTADO' as const
      : nuevoPeso.lt(rollo.pesoInicial) ? 'EN_USO_PARCIAL' as const
      : 'DISPONIBLE' as const;

    await tx.rollo.update({
      where: { id: cr.rolloId },
      data: { pesoActual: nuevoPeso.lt(0) ? new Prisma.Decimal(0) : nuevoPeso, estado: nuevoEstado },
    });
    await tx.movimientoInsumo.create({
      data: {
        tipo: 'CONSUMO',
        rolloId: cr.rolloId,
        ordenId,
        cantidad: kgConsumidos.neg(),
        motivo: `Corte OP ${orden.sku ?? ordenId}: ${cr.metrosUsados}m = ${kgConsumidos.toFixed(3)}kg`,
        usuarioId: session.id,
      },
    });
  }

  // Crear cortes por talle
  for (const t of cortesPorTalle) {
    await tx.cortePorTalle.create({
      data: { ordenId, talle: t.talle, cantidad: t.cantidad },
    });
  }

  // Avíos que lleva la prenda (del catálogo). No se descuenta acá: se anota
  // qué lleva y el stock se mueve al terminar producción.
  await tx.ordenAvio.deleteMany({ where: { ordenId } });
  if (avios && avios.length > 0) {
    for (const a of avios) {
      await tx.ordenAvio.create({
        data: { ordenId, etiquetaId: a.etiquetaId, cantidad: a.cantidad, origen: 'corte' },
      });
    }
  }

  // Actualizar OP
  const costoCorteDec = new Prisma.Decimal(costoCorte || 0);
  const costoTotal = costoTela.add(costoCorteDec);
  const updateData: Record<string, unknown> = {
    fichaCorteCargada: true,
    fichaFotoUrl: fichaFotoUrl || null,
    cortador: cortadorNombre,
    cortadorId: cortadorId || null,
    costoCorte: costoCorteDec,
    costoTela,
    costoInsumosSecundarios: new Prisma.Decimal(0),
    costoTotal,
    cantidad: cantidadTotal,
    fichaCorteData: fichaData ?? Prisma.JsonNull, // para ver/editar la ficha idéntica
    // Fecha del corte (mediodía UTC para que no se corra de día por zona horaria).
    fechaCorte: fechaCorte ? new Date(`${fechaCorte}T12:00:00Z`) : (orden.fechaCorte ?? new Date()),
    // La ficha ya NO cambia el estado: el avance del flujo se maneja aparte.
  };

  if (notas?.trim()) {
    updateData.notas = (orden.notas ? orden.notas + '\n' : '') + `[Corte] ${notas.trim()}`;
  }

  return tx.ordenProduccion.update({ where: { id: ordenId }, data: updateData });
}

/**
 * Revierte la ficha de corte de una orden dentro de una transacción: repone la tela a
 * los rollos/lotes (movimientos REVERSION), borra cortes por talle y avíos, y resetea la
 * OP (ficha sin cargar, costos en 0). No cambia el estado del flujo. Se usa en el endpoint
 * /revertir y en la edición (revert + re-registro atómico). No-op si no había ficha.
 */
export async function revertirCorteOrden(
  tx: Prisma.TransactionClient,
  ordenId: string,
  session: SessionPayload,
  // La edición de ficha (revierte + re-registra en la misma tx) es segura aun con la
  // orden terminada: solo cambia el consumo de rollos, NO toca el stock de terminados.
  // Por eso permite terminada. El "revertir" suelto sí queda bloqueado (dejaría la orden
  // terminada sin ficha).
  permitirTerminada = false,
) {
  const orden = await tx.ordenProduccion.findUnique({
    where: { id: ordenId },
    include: { movimientosInsumo: { where: { tipo: 'CONSUMO' } } },
  });
  if (!orden) throw new CorteError('OP no encontrada');
  if (!orden.fichaCorteCargada) return;
  if (orden.terminadoAt && !permitirTerminada) throw new CorteError('La orden ya está terminada. Retrocedela a Costura antes de editar o revertir la ficha.');

  for (const mov of orden.movimientosInsumo) {
    const inv = mov.cantidad.neg();
    if (mov.rolloId) {
      await tx.rollo.update({ where: { id: mov.rolloId }, data: { pesoActual: { increment: inv }, estado: 'DISPONIBLE' } });
    }
    if (mov.loteId) {
      await tx.lote.update({ where: { id: mov.loteId }, data: { cantidadActual: { increment: inv }, estado: 'DISPONIBLE' } });
    }
    await tx.movimientoInsumo.create({
      data: { tipo: 'REVERSION', rolloId: mov.rolloId, loteId: mov.loteId, ordenId, cantidad: inv, motivo: `Reversion corte OP ${orden.sku ?? ordenId}`, usuarioId: session.id, reversionNota: `Revertido por ${session.nombre}` },
    });
  }
  await tx.cortePorTalle.deleteMany({ where: { ordenId } });
  await tx.ordenAvio.deleteMany({ where: { ordenId } });
  await tx.ordenProduccion.update({
    where: { id: ordenId },
    data: {
      fichaCorteCargada: false, fichaFotoUrl: null, cortador: null, cortadorId: null,
      costoCorte: new Prisma.Decimal(0), costoTela: new Prisma.Decimal(0),
      costoInsumosSecundarios: new Prisma.Decimal(0), costoTotal: new Prisma.Decimal(0),
    },
  });
}
