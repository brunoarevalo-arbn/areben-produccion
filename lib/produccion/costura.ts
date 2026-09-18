import type { Prisma } from '@prisma/client';
import type { SessionPayload } from '@/lib/session';
import { parseDatos } from '@/lib/costos/escandallo';
import { cantidadCortada, cantidadIngresadaPorPartes, baseDeReparto } from './cantidades';
import { crearLoteCongelado, partesDelLote, type ParteDelLote } from './loteCorte';
import { partesDeOrden } from './conjuntos';

export class CosturaError extends Error {}

export interface TalleConteo { talle: string; cantidad: number; }

/**
 * Lo que salió de UNA pieza de la prenda. `parte: null` = la prenda no se parte (todas
 * las que existían antes de la temporada de bikinis).
 */
export interface ConteoDeParte { parte: string | null; talles: TalleConteo[]; }

/**
 * Ingresa UN LOTE de una orden dentro de una transacción: cuenta lo que salió por
 * talle → ingresa al stock de lisos terminados con su costo CONGELADO, descuenta los
 * avíos de esas piezas y, si con esto la orden completó lo cortado, la pasa a
 * TERMINADO_SIN_ESTAMPA. Lanza CosturaError ante validaciones.
 *
 * 🔑 Una prenda por partes (la bikini: se tiza junta y se vende por pieza) ingresa a DOS
 * SKU distintos en el mismo lote, cada uno con su conteo por talle y su propio costo —
 * el corpiño y la bombacha no cuestan lo mismo y no salen necesariamente iguales. Qué
 * prendas son así lo dice `ConjuntoPrenda`, una lista blanca, y se resuelve SIEMPRE por
 * el SKU de la orden (ver `lib/produccion/conjuntos.ts`).
 *
 * 🔑 Una orden puede entrar de a partes (la temporada de bikinis entra así a
 * propósito): mientras lo ingresado no alcance lo cortado, la OP SIGUE en COSTURA y
 * puede recibir otro lote. Antes esto terminaba la orden entera de una sola vez.
 *
 * `permitirSinCosto` es obligatorio: ver `calcularCostoCongelado`.
 *
 * Se usa tanto en el terminar por orden (cola/[id]/terminar) como en el terminar
 * por lote (lote/[loteId]/terminar), que la invoca una vez por color en la misma tx.
 */
export async function terminarCosturaOrden(
  tx: Prisma.TransactionClient,
  ordenId: string,
  conteosInput: ConteoDeParte[],
  session: SessionPayload,
  permitirSinCosto: boolean,
): Promise<number> {
  const orden = await tx.ordenProduccion.findUnique({ where: { id: ordenId } });
  if (!orden) throw new CosturaError('OP no encontrada');
  if (orden.estado !== 'COSTURA') throw new CosturaError(`La OP ${orden.sku ?? ordenId} no está en costura`);
  if (!orden.sku?.trim()) throw new CosturaError('La OP no tiene SKU asignado');

  const sku = orden.sku.trim();
  const conteos = conteosInput
    .map((c) => ({ parte: c.parte, talles: c.talles.filter((t) => t.cantidad > 0) }))
    .filter((c) => c.talles.length > 0);
  if (conteos.length === 0) throw new CosturaError(`Cargá la cantidad que salió de al menos un talle (${sku})`);

  // ¿Esta prenda se cose por partes? Lo dice el catálogo de conjuntos, leído en la misma
  // transacción y SIEMPRE por el SKU (ver lib/produccion/conjuntos.ts).
  const partesCatalogo = await partesDeOrden(tx, sku);
  const esPorPartes = partesCatalogo.length > 0;

  // 🔴 El chequeo cruzado: una prenda por partes que llegue sin pieza entraría entera al
  // SKU del conjunto (ZAT-BIK-…), que NO es un artículo que se venda. Y al revés, una
  // prenda común con una pieza encima ingresaría a un SKU derivado que no existe. Las dos
  // formas dejan mercadería en un código equivocado y el stock no se queja: se planta acá.
  const nombresValidos = new Set(partesCatalogo.map((p) => p.nombre));
  for (const c of conteos) {
    if (esPorPartes && (!c.parte || !nombresValidos.has(c.parte))) {
      throw new CosturaError(
        `${sku} se cose por partes (${partesCatalogo.map((p) => p.nombre).join(' + ')}): ` +
        `el conteo tiene que decir de qué pieza es${c.parte ? ` (llegó "${c.parte}")` : ''}.`,
      );
    }
    if (!esPorPartes && c.parte) {
      throw new CosturaError(`${sku} no es una prenda por partes, pero el conteo vino con la pieza "${c.parte}"`);
    }
  }
  if (new Set(conteos.map((c) => c.parte)).size !== conteos.length) {
    throw new CosturaError(`Hay piezas repetidas en el conteo de ${sku}`);
  }

  // El % de material sólo decide algo si hay material: una orden sin ficha de corte entra
  // en $0 igual (afirmándolo) y no habría nada que repartir.
  const hayMaterial = Number(orden.costoTotal) > 0 && baseDeReparto(orden) !== null;
  const partesLote = await partesDelLote(tx, orden, partesCatalogo, hayMaterial);
  const porNombre = new Map<string, ParteDelLote>(partesLote.map((p) => [p.nombre, p]));

  // El número de lote se calcula UNA vez para todo el ingreso: las dos piezas que entran
  // juntas son el mismo lote de la orden ("Lote 2 · Corpiño" y "Lote 2 · Bombacha").
  const ultimo = await tx.loteCorte.aggregate({ where: { ordenId }, _max: { numero: true } });
  const numeroLote = (ultimo._max.numero ?? 0) + 1;

  let totalProducido = 0;
  const detallePorParte: string[] = [];

  for (const c of conteos) {
    const parte = c.parte ? porNombre.get(c.parte) ?? null : null;
    const skuDestino = parte?.sku ?? sku;
    const unidades = c.talles.reduce((s, t) => s + t.cantidad, 0);
    totalProducido += unidades;

    // El lote va PRIMERO: es el que se planta si la orden no tiene con qué costear, y
    // plantarse antes de mover stock deja la transacción sin nada a medio hacer.
    await crearLoteCongelado(tx, orden, c.talles, session.nombre, permitirSinCosto, parte, numeroLote);

    for (const t of c.talles) {
      await tx.stockTerminado.upsert({
        where:  { sku_talle_tipo: { sku: skuDestino, talle: t.talle, tipo: 'liso' } },
        create: { sku: skuDestino, talle: t.talle, tipo: 'liso', cantidad: t.cantidad },
        update: { cantidad: { increment: t.cantidad } },
      });
      await tx.movimientoTerminado.create({
        data: {
          sku: skuDestino, talle: t.talle, tipo: 'liso',
          cantidad: t.cantidad,
          origen: 'produccion',
          ordenId,
          motivo: c.parte ? `Costura terminada · ${c.parte}` : 'Costura terminada',
          creadoPor: session.nombre,
        },
      });
    }

    detallePorParte.push(
      `${c.parte ? `${c.parte} ` : ''}${unidades} u (${c.talles.map((t) => `${t.talle}:${t.cantidad}`).join(', ')})`,
    );
  }

  // Descontar avíos del stock — POR LOTE, por las PIEZAS que entran ahora.
  //
  // 🔑 En una prenda por partes son las piezas y no las prendas (decisión de Bruno,
  // 18-sep-2026): el corpiño y la bombacha se venden por separado, así que cada uno sale
  // con su etiqueta. 40 bikinis descuentan 80. Por eso `totalProducido` suma TODAS las
  // piezas del ingreso y no las unidades del corte.
  // Receta: lo cargado en el corte; si está vacío, fallback al escandallo del SKU.
  //
  // 🔴 Antes el guard era `aviosDescontados` (una sola vez por ORDEN) y eso alcanzaba
  // mientras una orden entraba entera de una vez. Con ingreso parcial el primer lote se
  // llevaba el descuento y los siguientes NO descontaban nada, en silencio: 100 bikinis
  // en tres tandas descontaban las etiquetas de la primera. El evento que consume avíos
  // es el LOTE que entra, no la orden.
  let descontado = false;
  {
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

  // ¿Con este lote la orden completó lo que se cortó? Lo ingresado se DERIVA de los
  // movimientos —incluidos los que se acaban de crear en esta misma transacción—, así
  // que acá ya está contado el lote de recién.
  // 🔴 En una prenda por partes esto NO es la suma de las piezas: 40 corpiños + 40
  // bombachas son 40 bikinis, no 80, y sumarlas daría la orden por completa con la mitad
  // de las piezas adentro. El avance lo marca la pieza que menos entró.
  const ingresadoTotal = await cantidadIngresadaPorPartes(tx, ordenId, partesLote.map((p) => p.sku));
  const meta = cantidadCortada(orden);
  const completo = ingresadoTotal >= meta;

  const detalleTalles = detallePorParte.join(' · ');

  await tx.ordenProduccion.update({
    where: { id: ordenId },
    data: {
      // `cantidad` NO se toca: es lo planificado. Lo producido se deriva de los
      // MovimientoTerminado de la orden (`cantidadIngresada` en lib/produccion/cantidades.ts).
      // El estado sólo avanza cuando lo ingresado alcanza lo cortado: si falta, la OP
      // sigue en COSTURA y puede recibir otro lote.
      //
      // 🔴 `terminadoAt` se LIMPIA en el parcial, no se deja como estaba. Una orden que
      // retrocedió a costura conserva el `terminadoAt` de su vuelta anterior, y ese campo
      // se usa en otro lado como "esta orden ya terminó" (`aviosStock.ts` busca por
      // `terminadoAt: { not: null }`): dejarlo puesto mientras la OP sigue cosiendo la
      // hace figurar como terminada en una pantalla y en costura en otra.
      ...(completo
        ? { estado: 'TERMINADO_SIN_ESTAMPA' as const, terminadoAt: new Date() }
        : { terminadoAt: null }),
      // El aviso de la tablet ya cumplió: el taller contó e ingresó.
      avisoCosturaAt: null, avisoCosturaPor: null,
      ...(descontado ? { aviosDescontados: true } : {}),
    },
  });

  if (completo) {
    await tx.estadoTransicion.create({
      data: {
        ordenId,
        estadoAnterior: 'COSTURA',
        estadoNuevo: 'TERMINADO_SIN_ESTAMPA',
        usuarioId: session.id,
        notas: `Costura terminada en ${numeroLote} lote${numeroLote > 1 ? 's' : ''}: ` +
               `${ingresadoTotal} u de ${meta} cortadas. Último lote: ${detalleTalles} → stock`,
      },
    });
  } else {
    // Queda en COSTURA, pero el lote parcial tiene que dejar rastro: sin esto un
    // ingreso de 30 de 100 no aparece en ningún historial hasta que la orden cierre.
    await tx.estadoTransicion.create({
      data: {
        ordenId,
        estadoAnterior: 'COSTURA',
        estadoNuevo: 'COSTURA',
        usuarioId: session.id,
        notas: `Lote ${numeroLote}: ${detalleTalles} → stock. ` +
               `Van ${ingresadoTotal} de ${meta} cortadas — la orden sigue en costura.`,
      },
    });
  }

  return totalProducido;
}
