// Ejercicio del ingreso por LOTE contra una copia de la base. ⛔ NO correr contra prod:
// escribe stock, avíos y lotes de verdad.
//
//   DIRECT_URL=postgresql://brunoarevalo@127.0.0.1:5432/areben_test \
//     npx tsx prisma/check-lote-corte-ejercicio.ts
//
// El oráculo se lee con SQL crudo, ⛔ no con los helpers que se están probando: si el
// bug estuviera en `cantidadIngresada`, preguntarle a ella si funcionó daría verde igual.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { terminarCosturaOrden, CosturaError } from '../lib/produccion/costura';
import { LoteCorteError } from '../lib/produccion/loteCorte';
import { TerminarCosturaSchema, TerminarLoteSchema } from '../lib/validators/produccion';

const url = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
if (!/127\.0\.0\.1|localhost/.test(url)) {
  console.error('⛔ Esto escribe. Apuntá DIRECT_URL a la copia local, no a producción.');
  console.error(`   URL recibida: ${url.replace(/:[^:@/]+@/, ':***@').slice(0, 60)}…`);
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const session = { id: 'check', nombre: 'Ejercicio', rol: 'admin', permisos: [] } as never;

const sql = (q: string) => prisma.$queryRawUnsafe<Record<string, unknown>[]>(q);
/** La bikini se cose por partes: todo ingreso suyo va POR PIEZA. */
const PARTES = ['Corpiño', 'Bombacha'];
let fallos = 0;
function chequear(nombre: string, ok: boolean, detalle: string) {
  console.log(`  ${ok ? '✅' : '❌'} ${nombre} — ${detalle}`);
  if (!ok) fallos++;
}

/** El conteo de un ingreso de una prenda por partes: la misma cantidad en cada pieza. */
const porPartes = (talles: { talle: string; cantidad: number }[]) =>
  PARTES.map((parte) => ({ parte, talles }));

async function main() {
  const SKU = 'ZAT-BIK-VER-001';
  const SKU_PIEZA: Record<string, string> = { 'Corpiño': 'ZAT-COR-VER-001', 'Bombacha': 'ZAT-BOM-VER-001' };
  const orden = await prisma.ordenProduccion.findUnique({ where: { sku: SKU } });
  if (!orden) throw new Error(`No existe la OP ${SKU} en esta copia`);
  console.log(`\nOP ${SKU}: estado ${orden.estado}, plan ${orden.cantidad}, ` +
              `cortado ${orden.cantidadCortada ?? '—'}, costoTotal $${orden.costoTotal}`);

  // Limpio ejercicios anteriores para que la corrida sea repetible. ⚠️ Tiene que quedar
  // TODO como antes: la primera vez esto no borraba el stock ni `terminadoAt`, la corrida
  // dio verde por la base limpia y el rojo recién apareció en la segunda.
  await prisma.$executeRawUnsafe(`DELETE FROM lotes_corte WHERE "ordenId" = '${orden.id}'`);
  await prisma.$executeRawUnsafe(
    `DELETE FROM movimientos_terminado WHERE "ordenId" = '${orden.id}' AND origen = 'produccion'`);
  await prisma.$executeRawUnsafe(
    `DELETE FROM stock_terminado WHERE sku IN ('${SKU}','ZAT-COR-VER-001','ZAT-BOM-VER-001') AND tipo = 'liso'`);

  // El catálogo tiene que poder decir a qué SKU va cada pieza. Sin esto el ingreso se
  // planta, que es correcto pero convierte todos los chequeos que siguen en el mismo.
  const abrevs = await sql(
    `SELECT p.nombre, p."skuAbrev" FROM partes_prenda p
       JOIN conjuntos_prenda c ON c.id = p."conjuntoId" WHERE c."prendaAbrev"='BIK'`);
  if (abrevs.some((a) => !a.skuAbrev)) {
    throw new Error('Las partes de BIK no tienen skuAbrev en esta copia: corré ' +
                    'npx tsx prisma/seed-conjuntos-prenda.ts --aplicar');
  }
  await prisma.ordenProduccion.update({
    where: { id: orden.id },
    data: { estado: 'COSTURA', terminadoAt: null },
  });

  // ---------- 1. Sin costo de material, se PLANTA ----------
  console.log('\n=== 1. Una orden sin ficha de corte no puede congelar un $0 callado ===');
  let mensaje = '';
  try {
    await prisma.$transaction((tx) =>
      terminarCosturaOrden(tx, orden.id, porPartes([{ talle: 'M', cantidad: 10 }]), session, false));
  } catch (e) {
    if (e instanceof LoteCorteError || e instanceof CosturaError) mensaje = e.message;
    else throw e;
  }
  chequear('se planta', mensaje.length > 0, mensaje || 'NO se plantó: dejó pasar un lote en $0');
  const trasFallo = await sql(`SELECT count(*)::int AS n FROM lotes_corte WHERE "ordenId"='${orden.id}'`);
  chequear('no dejó nada a medio hacer', Number(trasFallo[0].n) === 0, `lotes creados: ${trasFallo[0].n}`);

  // ---------- 2. Afirmado, entra y queda MARCADO ----------
  console.log('\n=== 2. Afirmando que no hay costo, entra y queda marcado ===');
  await prisma.$transaction((tx) =>
    terminarCosturaOrden(tx, orden.id, porPartes([{ talle: 'M', cantidad: 10 }, { talle: 'L', cantidad: 5 }]), session, true));

  const l1 = await sql(`SELECT numero, parte, sku, unidades, "sinCostoMaterial", "minutosImputados",
                               "minutosCompartidos", "costoMoUnit",
                               "costoMaterialUnit", "costoUnitario", "costoMinuto"
                        FROM lotes_corte WHERE "ordenId"='${orden.id}' ORDER BY numero, parte`);
  chequear('un lote POR PIEZA', l1.length === 2, `lotes: ${l1.length} (${l1.map((l) => l.parte).join(', ')})`);
  chequear('los dos son el LOTE 1', l1.every((l) => Number(l.numero) === 1),
           `numeros=${l1.map((l) => l.numero).join(', ')} — si fueran 1 y 2, la orden parecería haber recibido dos lotes`);
  chequear('cada pieza a SU sku', l1.every((l) => l.sku === SKU_PIEZA[String(l.parte)]),
           l1.map((l) => `${l.parte}→${l.sku}`).join(' · '));
  chequear('15 unidades cada una', l1.every((l) => Number(l.unidades) === 15),
           `unidades=${l1.map((l) => l.unidades).join(', ')}`);
  chequear('marcado sin costo de material', l1[0]?.sinCostoMaterial === true,
           `sinCostoMaterial=${l1[0]?.sinCostoMaterial}`);
  const moUnit1 = Number(l1[0]?.costoMoUnit);
  const min1 = l1.reduce((s, l) => s + Number(l.minutosImputados), 0);
  chequear('se llevó minutos de costura', min1 > 0, `${min1} min → $${moUnit1}/u a $${Number(l1[0]?.costoMinuto)}/min`);

  const stock = await sql(`SELECT sku, talle, cantidad FROM stock_terminado
                           WHERE tipo='liso' AND sku LIKE 'ZAT-%-VER-001' ORDER BY sku, talle`);
  chequear('entró al stock de las DOS piezas', stock.length === 4, JSON.stringify(stock));
  // 🔴 El error que este chequeo ataja: que las piezas entren al SKU del CONJUNTO, que
  // no es un artículo que se venda — y el stock no se queja, crea la fila que le pidan.
  chequear('nada quedó en el SKU del conjunto', !stock.some((s) => s.sku === SKU),
           `filas en ${SKU}: ${stock.filter((s) => s.sku === SKU).length}`);

  // ---------- 3. La orden NO terminó: sigue en COSTURA ----------
  console.log('\n=== 3. Con 15 de 40, la orden sigue en costura ===');
  const est1 = await sql(`SELECT estado, "terminadoAt" FROM ordenes_produccion WHERE id='${orden.id}'`);
  chequear('sigue en COSTURA', est1[0].estado === 'COSTURA', `estado=${est1[0].estado}`);
  chequear('sin terminadoAt', est1[0].terminadoAt === null, `terminadoAt=${est1[0].terminadoAt}`);

  // ---------- 4. El 2º lote NO se lleva los minutos del 1º ----------
  console.log('\n=== 4. El segundo lote no vuelve a cobrar los minutos del primero ===');
  await prisma.$transaction((tx) =>
    terminarCosturaOrden(tx, orden.id, porPartes([{ talle: 'M', cantidad: 5 }]), session, true));
  const l2 = await sql(`SELECT numero, parte, "minutosImputados", "costoMoUnit" FROM lotes_corte
                        WHERE "ordenId"='${orden.id}' ORDER BY numero, parte`);
  chequear('hay 2 lotes (4 filas, 2 piezas c/u)', new Set(l2.map((l) => l.numero)).size === 2,
           `lotes: ${[...new Set(l2.map((l) => l.numero))].join(', ')} · filas: ${l2.length}`);
  const min2 = l2.filter((l) => Number(l.numero) === 2).reduce((s, l) => s + Number(l.minutosImputados), 0);
  chequear('el 2º se lleva sólo lo nuevo', min2 < min1,
           `lote 1: ${min1} min · lote 2: ${min2} min (si fueran iguales, cobraría dos veces)`);

  // ---------- 5. Los minutos de MUESTRA quedan afuera ----------
  console.log('\n=== 5. Los minutos de muestra no se cobran dos veces ===');
  const muestras = await sql(
    `SELECT COALESCE(SUM("minutosNetos"),0)::float AS m FROM tiempos_produccion
     WHERE sku='${SKU}' AND estado='guardado'
       AND (actividad IN ('Muestra - Relevamiento','Muestra - Medición','Muestra Zattia','Muestra Stunned'))`);
  const todos = await sql(
    `SELECT COALESCE(SUM("minutosNetos"),0)::float AS m FROM tiempos_produccion
     WHERE sku='${SKU}' AND estado='guardado'`);
  const imputadoTotal = min1 + min2;
  const esperado = Number(todos[0].m) - Number(muestras[0].m);
  chequear('imputó costura y no muestra', Math.abs(imputadoTotal - esperado) < 0.5,
           `imputado ${imputadoTotal} · costura real ${esperado} (total ${todos[0].m} − muestra ${muestras[0].m})`);

  // ---------- 6. Completar cierra la orden ----------
  console.log('\n=== 6. Al completar lo cortado, la orden avanza ===');
  const falta = orden.cantidad - 20;
  await prisma.$transaction((tx) =>
    terminarCosturaOrden(tx, orden.id, porPartes([{ talle: 'M', cantidad: falta }]), session, true));
  const est2 = await sql(`SELECT estado, "terminadoAt" FROM ordenes_produccion WHERE id='${orden.id}'`);
  chequear('pasó a TERMINADO_SIN_ESTAMPA', est2[0].estado === 'TERMINADO_SIN_ESTAMPA', `estado=${est2[0].estado}`);
  chequear('con terminadoAt', est2[0].terminadoAt !== null, `terminadoAt=${est2[0].terminadoAt}`);
  // 🔴 En una prenda por partes los movimientos son el DOBLE de las unidades del corte
  // (cada bikini son dos piezas). El avance se mide por pieza, no sumándolas: sumarlas
  // daría la orden por completa con la mitad de las piezas adentro.
  const ing = await sql(`SELECT sku, COALESCE(SUM(cantidad),0)::int AS n FROM movimientos_terminado
                         WHERE "ordenId"='${orden.id}' AND origen='produccion' GROUP BY sku ORDER BY sku`);
  chequear('cada pieza ingresó lo planificado', ing.every((r) => Number(r.n) === orden.cantidad),
           ing.map((r) => `${r.sku}: ${r.n}`).join(' · ') + ` (plan ${orden.cantidad})`);

  // ---------- 7. Regresión: una orden que YA había terminado y vuelve a costura ----------
  // Lo destapó correr el ejercicio dos veces: la OP quedaba en COSTURA con el
  // `terminadoAt` de la vuelta anterior, y `aviosStock` busca las terminadas por ese
  // campo ⇒ figuraba terminada en una pantalla y en costura en otra.
  console.log('\n=== 7. Una orden que retrocede a costura no se queda con el terminadoAt viejo ===');
  await prisma.ordenProduccion.update({ where: { id: orden.id }, data: { estado: 'COSTURA' } });
  const antes = await sql(`SELECT "terminadoAt" FROM ordenes_produccion WHERE id='${orden.id}'`);
  chequear('arranca con terminadoAt puesto', antes[0].terminadoAt !== null, `terminadoAt=${antes[0].terminadoAt}`);
  await prisma.$executeRawUnsafe(
    `DELETE FROM movimientos_terminado WHERE "ordenId"='${orden.id}' AND origen='produccion'`);
  await prisma.$transaction((tx) =>
    terminarCosturaOrden(tx, orden.id, porPartes([{ talle: 'M', cantidad: 3 }]), session, true));
  const est3 = await sql(`SELECT estado, "terminadoAt" FROM ordenes_produccion WHERE id='${orden.id}'`);
  chequear('el parcial lo limpia', est3[0].terminadoAt === null,
           `estado=${est3[0].estado} · terminadoAt=${est3[0].terminadoAt}`);

  // ---------- 8. El lote dice SOBRE QUÉ se repartió el material ----------
  // `cantidadCortada()` cae a lo planificado sin decirlo: 40 puede ser "se cortaron 40" o
  // "nadie cortó y hay 40 planificadas". Como el lote CONGELA el unitario, si no guarda la
  // procedencia no hay forma de encontrar después los que se repartieron mal.
  // ⚠️ La forma natural de equivocarse es derivarlo de `unidades > 0`, que da 'cortado'
  // para una orden con el campo en NULL. Por eso el primer caso es justamente ése.
  console.log('\n=== 8. El material dice si se dividió por lo cortado o por lo planificado ===');
  // La bikini reparte el material entre sus piezas por un % DECLARADO. Acá se declara
  // 40/60 para poder ejercer el reparto; el chequeo 9 prueba justamente que sin esto se
  // planta. Al final se vuelve a dejar en NULL, que es como está en producción.
  const setPorcentajes = async (valores: (number | null)[]) => {
    for (const [i, parte] of PARTES.entries()) {
      await prisma.$executeRawUnsafe(
        `UPDATE partes_prenda SET "porcentajeMaterial" = ${valores[i] === null ? 'NULL' : valores[i]}
           WHERE nombre = '${parte}' AND "conjuntoId" IN (SELECT id FROM conjuntos_prenda WHERE "prendaAbrev"='BIK')`);
    }
  };
  await setPorcentajes([40, 60]);

  const limpiar = async () => {
    await prisma.$executeRawUnsafe(`DELETE FROM lotes_corte WHERE "ordenId"='${orden.id}'`);
    await prisma.$executeRawUnsafe(
      `DELETE FROM movimientos_terminado WHERE "ordenId"='${orden.id}' AND origen='produccion'`);
    await prisma.ordenProduccion.update({
      where: { id: orden.id }, data: { estado: 'COSTURA', terminadoAt: null } });
  };

  // 8a. Sin corte cargado (cantidadCortada NULL) pero CON costo ⇒ 'planificado'.
  await limpiar();
  await prisma.ordenProduccion.update({
    where: { id: orden.id }, data: { costoTotal: 40000, cantidadCortada: null } });
  await prisma.$transaction((tx) =>
    terminarCosturaOrden(tx, orden.id, porPartes([{ talle: 'M', cantidad: 10 }]), session, false));
  const a = (await sql(`SELECT "baseMaterial", "unidadesBase", "costoMaterialUnit" FROM lotes_corte
                        WHERE "ordenId"='${orden.id}' ORDER BY numero DESC, parte LIMIT 1`))[0];
  chequear('sin corte cargado rotula PLANIFICADO', a.baseMaterial === 'planificado',
           `baseMaterial=${a.baseMaterial} · ÷${a.unidadesBase} · $${Number(a.costoMaterialUnit)}/u`);
  chequear('y divide por el plan (40)', Number(a.unidadesBase) === orden.cantidad,
           `unidadesBase=${a.unidadesBase}, plan=${orden.cantidad}`);

  // 8b. Con corte cargado en 32 ⇒ 'cortado', y el unitario SE MUEVE.
  await limpiar();
  await prisma.ordenProduccion.update({ where: { id: orden.id }, data: { cantidadCortada: 32 } });
  await prisma.$transaction((tx) =>
    terminarCosturaOrden(tx, orden.id, porPartes([{ talle: 'M', cantidad: 10 }]), session, false));
  const b = (await sql(`SELECT "baseMaterial", "unidadesBase", "costoMaterialUnit" FROM lotes_corte
                        WHERE "ordenId"='${orden.id}' ORDER BY numero DESC, parte LIMIT 1`))[0];
  chequear('con corte cargado rotula CORTADO', b.baseMaterial === 'cortado',
           `baseMaterial=${b.baseMaterial} · ÷${b.unidadesBase} · $${Number(b.costoMaterialUnit)}/u`);
  chequear('divide por lo cortado (32)', Number(b.unidadesBase) === 32, `unidadesBase=${b.unidadesBase}`);
  chequear('el unitario se movió de verdad', Number(b.costoMaterialUnit) > Number(a.costoMaterialUnit),
           `$${Number(a.costoMaterialUnit)} (÷40) → $${Number(b.costoMaterialUnit)} (÷32) = ` +
           `${(100 * (Number(b.costoMaterialUnit) / Number(a.costoMaterialUnit) - 1)).toFixed(1)}%`);

  // ---------- 9. Sin el % declarado NO se puede repartir, y NO es afirmable ----------
  // Es el otro freno, y es distinto del de la ficha de corte: ahí falta una DECISIÓN que
  // alguien puede afirmar ("entrá igual, sin material"); acá falta un DATO. Tildar una
  // casilla no lo conseguiría, sólo congelaría un reparto inventado — por eso el error
  // viaja con `afirmable: false` y la pantalla no ofrece la salida.
  console.log('\n=== 9. Sin el % de material de cada pieza, el ingreso se planta sin ofrecer salida ===');
  await limpiar();
  await setPorcentajes([null, null]);
  await prisma.ordenProduccion.update({
    where: { id: orden.id }, data: { costoTotal: 40000, cantidadCortada: 32 } });
  let err: LoteCorteError | null = null;
  try {
    await prisma.$transaction((tx) =>
      terminarCosturaOrden(tx, orden.id, porPartes([{ talle: 'M', cantidad: 10 }]), session, true));
  } catch (e) { if (e instanceof LoteCorteError) err = e; else throw e; }
  chequear('se planta aunque venga AFIRMADO', err !== null,
           err ? err.message : 'dejó pasar un lote con el material repartido a ojo');
  chequear('y no lo ofrece como casilla', err?.afirmable === false, `afirmable=${err?.afirmable}`);

  // ---------- 10. El material se parte por el %, y lo que se reparte es TODO ----------
  console.log('\n=== 10. El material se reparte por el % declarado, sin perder ni inventar plata ===');
  await limpiar();
  await setPorcentajes([40, 60]);
  await prisma.$transaction((tx) =>
    terminarCosturaOrden(tx, orden.id, porPartes([{ talle: 'M', cantidad: 10 }]), session, false));
  const rep = await sql(`SELECT parte, "costoMaterialUnit"::float AS m, "unidadesBase"
                         FROM lotes_corte WHERE "ordenId"='${orden.id}' ORDER BY parte`);
  const porParte = new Map(rep.map((r) => [String(r.parte), Number(r.m)]));
  const unitarioCorte = 40000 / 32;
  chequear('corpiño se lleva el 40%', Math.abs((porParte.get('Corpiño') ?? 0) - unitarioCorte * 0.4) < 0.02,
           `$${porParte.get('Corpiño')}/u contra ${(unitarioCorte * 0.4).toFixed(2)}`);
  chequear('bombacha el 60%', Math.abs((porParte.get('Bombacha') ?? 0) - unitarioCorte * 0.6) < 0.02,
           `$${porParte.get('Bombacha')}/u contra ${(unitarioCorte * 0.6).toFixed(2)}`);
  // 🔑 El chequeo que importa: la bikini entera sigue costando lo mismo que antes de
  // partirla. Si las dos mitades no suman el unitario del corte, el corte perdió o ganó
  // plata al repartir — y el lote lo CONGELA.
  const suma = (porParte.get('Corpiño') ?? 0) + (porParte.get('Bombacha') ?? 0);
  chequear('las dos piezas suman la prenda entera', Math.abs(suma - unitarioCorte) < 0.02,
           `$${suma.toFixed(2)} contra $${unitarioCorte.toFixed(2)} del corte`);

  // ---------- 11. Los minutos: los medidos a su pieza, los demás mitad y mitad ----------
  // El oráculo se arma con SQL crudo desde `tiempos_produccion`, ⛔ no llamando a la
  // función que se está probando.
  console.log('\n=== 11. Los minutos etiquetados van a su pieza; los que no, mitad y mitad ===');
  const porEtiqueta = await sql(
    `SELECT COALESCE(parte,'(sin parte)') AS parte, SUM("minutosNetos")::float AS m
       FROM tiempos_produccion
      WHERE sku='${SKU}' AND estado='guardado'
        AND actividad NOT IN ('Muestra - Relevamiento','Muestra - Medición','Muestra Zattia','Muestra Stunned')
      GROUP BY 1`);
  const medidos = (p: string) => Number(porEtiqueta.find((r) => r.parte === p)?.m ?? 0);
  const pool = porEtiqueta
    .filter((r) => !PARTES.includes(String(r.parte)))
    .reduce((s, r) => s + Number(r.m), 0);
  const mins = await sql(`SELECT parte, "minutosImputados"::float AS m, "minutosCompartidos"::float AS c
                          FROM lotes_corte WHERE "ordenId"='${orden.id}' ORDER BY parte`);
  for (const parte of PARTES) {
    const fila = mins.find((r) => r.parte === parte);
    const esperado = medidos(parte) + pool / PARTES.length;
    chequear(`${parte}: medidos + la mitad de los sueltos`,
             Math.abs(Number(fila?.m ?? 0) - esperado) < 0.02,
             `${fila?.m} min contra ${esperado.toFixed(2)} (${medidos(parte)} medidos + ${(pool / 2).toFixed(2)} de ${pool.toFixed(2)} sin pieza)`);
    chequear(`${parte}: dice cuántos NO estaban medidos`,
             Math.abs(Number(fila?.c ?? 0) - pool / PARTES.length) < 0.02,
             `minutosCompartidos=${fila?.c}`);
  }

  // ---------- 12. Una sola pieza NO completa el corte ----------
  // 🔴 El error que ataja: sumar las piezas. 32 corpiños de un corte de 32 daría 32 >= 32
  // y la orden cerraría con CERO bombachas adentro.
  console.log('\n=== 12. Con una sola pieza entera, el corte NO está terminado ===');
  await limpiar();
  await prisma.$transaction((tx) =>
    terminarCosturaOrden(tx, orden.id, [{ parte: 'Corpiño', talles: [{ talle: 'M', cantidad: 32 }] }], session, false));
  const est4 = await sql(`SELECT estado FROM ordenes_produccion WHERE id='${orden.id}'`);
  chequear('sigue en COSTURA con 32 corpiños y 0 bombachas', est4[0].estado === 'COSTURA',
           `estado=${est4[0].estado}`);
  await prisma.$transaction((tx) =>
    terminarCosturaOrden(tx, orden.id, [{ parte: 'Bombacha', talles: [{ talle: 'M', cantidad: 32 }] }], session, false));
  const est5 = await sql(`SELECT estado FROM ordenes_produccion WHERE id='${orden.id}'`);
  chequear('con la bombacha sí termina', est5[0].estado === 'TERMINADO_SIN_ESTAMPA', `estado=${est5[0].estado}`);

  // ---------- 13. Una prenda por partes no puede entrar sin decir cuál ----------
  console.log('\n=== 13. Un conteo sin pieza no entra al SKU del conjunto ===');
  await limpiar();
  let sinPieza = '';
  try {
    await prisma.$transaction((tx) =>
      terminarCosturaOrden(tx, orden.id, [{ parte: null, talles: [{ talle: 'M', cantidad: 5 }] }], session, true));
  } catch (e) { if (e instanceof CosturaError) sinPieza = e.message; else throw e; }
  chequear('se planta', sinPieza.length > 0, sinPieza || `dejó entrar mercadería a ${SKU}`);

  // ---------- 14. El contrato con la pantalla ----------
  // 🔴 El ejercicio llama al núcleo directo, así que un cambio de FORMA del payload no lo
  // caza: la pantalla podría seguir mandando `talles` contra una ruta que ahora espera
  // `conteos` y todo lo de arriba seguiría verde. Acá se parsea, con los validadores de
  // verdad, exactamente lo que arman `ColaAdmin` y `TerminarLoteForm`.
  console.log('\n=== 14. Lo que mandan las pantallas entra por los validadores de las rutas ===');
  const deColaAdmin = {
    conteos: [
      { parte: 'Corpiño',  talles: [{ talle: 'M', cantidad: 10 }] },
      { parte: 'Bombacha', talles: [{ talle: 'M', cantidad: 9 }] },
    ],
    permitirSinCosto: false,
  };
  const deColaAdminSimple = { conteos: [{ parte: null, talles: [{ talle: 'M', cantidad: 10 }] }], permitirSinCosto: true };
  const deTerminarLote = {
    colores: [{ ordenId: orden.id, conteos: [{ parte: 'Corpiño', talles: [{ talle: 'M', cantidad: 5 }] }] }],
  };
  for (const [nombre, payload, schema] of [
    ['ColaAdmin por partes', deColaAdmin, TerminarCosturaSchema],
    ['ColaAdmin prenda entera', deColaAdminSimple, TerminarCosturaSchema],
    ['TerminarLoteForm', deTerminarLote, TerminarLoteSchema],
  ] as const) {
    const r = schema.safeParse(payload);
    chequear(nombre, r.success, r.success ? 'parsea' : JSON.stringify(r.error.issues[0]));
  }

  // Dejo la OP como estaba: sin corte y sin costo, que es como está en producción.
  await limpiar();
  await prisma.ordenProduccion.update({
    where: { id: orden.id }, data: { costoTotal: 0, cantidadCortada: null } });
  await prisma.$executeRawUnsafe(
    `DELETE FROM stock_terminado WHERE sku IN ('${SKU}','ZAT-COR-VER-001','ZAT-BOM-VER-001') AND tipo='liso'`);
  // El % vuelve a NULL: en producción todavía no lo dijo nadie (sale de hablar con el
  // cortador) y dejarlo en 40/60 haría pasar por declarado un número del ejercicio.
  await setPorcentajes([null, null]);

  console.log(`\n${fallos === 0 ? '✅ TODO VERDE' : `❌ ${fallos} CHEQUEO(S) EN ROJO`}\n`);
  process.exitCode = fallos === 0 ? 0 : 1;
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
