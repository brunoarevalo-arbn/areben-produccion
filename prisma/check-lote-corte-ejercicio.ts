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

const url = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
if (!/127\.0\.0\.1|localhost/.test(url)) {
  console.error('⛔ Esto escribe. Apuntá DIRECT_URL a la copia local, no a producción.');
  console.error(`   URL recibida: ${url.replace(/:[^:@/]+@/, ':***@').slice(0, 60)}…`);
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const session = { id: 'check', nombre: 'Ejercicio', rol: 'admin', permisos: [] } as never;

const sql = (q: string) => prisma.$queryRawUnsafe<Record<string, unknown>[]>(q);
let fallos = 0;
function chequear(nombre: string, ok: boolean, detalle: string) {
  console.log(`  ${ok ? '✅' : '❌'} ${nombre} — ${detalle}`);
  if (!ok) fallos++;
}

async function main() {
  const SKU = 'ZAT-BIK-VER-001';
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
  await prisma.$executeRawUnsafe(`DELETE FROM stock_terminado WHERE sku = '${SKU}' AND tipo = 'liso'`);
  await prisma.ordenProduccion.update({
    where: { id: orden.id },
    data: { estado: 'COSTURA', terminadoAt: null },
  });

  // ---------- 1. Sin costo de material, se PLANTA ----------
  console.log('\n=== 1. Una orden sin ficha de corte no puede congelar un $0 callado ===');
  let mensaje = '';
  try {
    await prisma.$transaction((tx) =>
      terminarCosturaOrden(tx, orden.id, [{ talle: 'M', cantidad: 10 }], session, false));
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
    terminarCosturaOrden(tx, orden.id, [{ talle: 'M', cantidad: 10 }, { talle: 'L', cantidad: 5 }], session, true));

  const l1 = await sql(`SELECT numero, unidades, "sinCostoMaterial", "minutosImputados", "costoMoUnit",
                               "costoMaterialUnit", "costoUnitario", "costoMinuto"
                        FROM lotes_corte WHERE "ordenId"='${orden.id}' ORDER BY numero`);
  chequear('se creó 1 lote', l1.length === 1, `lotes: ${l1.length}`);
  chequear('numerado 1', Number(l1[0]?.numero) === 1, `numero=${l1[0]?.numero}`);
  chequear('15 unidades', Number(l1[0]?.unidades) === 15, `unidades=${l1[0]?.unidades}`);
  chequear('marcado sin costo de material', l1[0]?.sinCostoMaterial === true,
           `sinCostoMaterial=${l1[0]?.sinCostoMaterial}`);
  const moUnit1 = Number(l1[0]?.costoMoUnit);
  const min1 = Number(l1[0]?.minutosImputados);
  chequear('se llevó minutos de costura', min1 > 0, `${min1} min → $${moUnit1}/u a $${Number(l1[0]?.costoMinuto)}/min`);

  const stock = await sql(`SELECT talle, cantidad FROM stock_terminado WHERE sku='${SKU}' AND tipo='liso' ORDER BY talle`);
  chequear('entró al stock', stock.length === 2, JSON.stringify(stock));

  // ---------- 3. La orden NO terminó: sigue en COSTURA ----------
  console.log('\n=== 3. Con 15 de 40, la orden sigue en costura ===');
  const est1 = await sql(`SELECT estado, "terminadoAt" FROM ordenes_produccion WHERE id='${orden.id}'`);
  chequear('sigue en COSTURA', est1[0].estado === 'COSTURA', `estado=${est1[0].estado}`);
  chequear('sin terminadoAt', est1[0].terminadoAt === null, `terminadoAt=${est1[0].terminadoAt}`);

  // ---------- 4. El 2º lote NO se lleva los minutos del 1º ----------
  console.log('\n=== 4. El segundo lote no vuelve a cobrar los minutos del primero ===');
  await prisma.$transaction((tx) =>
    terminarCosturaOrden(tx, orden.id, [{ talle: 'M', cantidad: 5 }], session, true));
  const l2 = await sql(`SELECT numero, "minutosImputados", "costoMoUnit" FROM lotes_corte
                        WHERE "ordenId"='${orden.id}' ORDER BY numero`);
  chequear('hay 2 lotes', l2.length === 2, `lotes: ${l2.map((l) => l.numero).join(', ')}`);
  const min2 = Number(l2[1]?.minutosImputados);
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
    terminarCosturaOrden(tx, orden.id, [{ talle: 'M', cantidad: falta }], session, true));
  const est2 = await sql(`SELECT estado, "terminadoAt" FROM ordenes_produccion WHERE id='${orden.id}'`);
  chequear('pasó a TERMINADO_SIN_ESTAMPA', est2[0].estado === 'TERMINADO_SIN_ESTAMPA', `estado=${est2[0].estado}`);
  chequear('con terminadoAt', est2[0].terminadoAt !== null, `terminadoAt=${est2[0].terminadoAt}`);
  const ing = await sql(`SELECT COALESCE(SUM(cantidad),0)::int AS n FROM movimientos_terminado
                         WHERE "ordenId"='${orden.id}' AND origen='produccion'`);
  chequear('ingresó lo planificado', Number(ing[0].n) === orden.cantidad, `${ing[0].n} de ${orden.cantidad}`);

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
    terminarCosturaOrden(tx, orden.id, [{ talle: 'M', cantidad: 3 }], session, true));
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
    terminarCosturaOrden(tx, orden.id, [{ talle: 'M', cantidad: 10 }], session, false));
  const a = (await sql(`SELECT "baseMaterial", "unidadesBase", "costoMaterialUnit" FROM lotes_corte
                        WHERE "ordenId"='${orden.id}' ORDER BY numero DESC LIMIT 1`))[0];
  chequear('sin corte cargado rotula PLANIFICADO', a.baseMaterial === 'planificado',
           `baseMaterial=${a.baseMaterial} · ÷${a.unidadesBase} · $${Number(a.costoMaterialUnit)}/u`);
  chequear('y divide por el plan (40)', Number(a.unidadesBase) === orden.cantidad,
           `unidadesBase=${a.unidadesBase}, plan=${orden.cantidad}`);

  // 8b. Con corte cargado en 32 ⇒ 'cortado', y el unitario SE MUEVE.
  await limpiar();
  await prisma.ordenProduccion.update({ where: { id: orden.id }, data: { cantidadCortada: 32 } });
  await prisma.$transaction((tx) =>
    terminarCosturaOrden(tx, orden.id, [{ talle: 'M', cantidad: 10 }], session, false));
  const b = (await sql(`SELECT "baseMaterial", "unidadesBase", "costoMaterialUnit" FROM lotes_corte
                        WHERE "ordenId"='${orden.id}' ORDER BY numero DESC LIMIT 1`))[0];
  chequear('con corte cargado rotula CORTADO', b.baseMaterial === 'cortado',
           `baseMaterial=${b.baseMaterial} · ÷${b.unidadesBase} · $${Number(b.costoMaterialUnit)}/u`);
  chequear('divide por lo cortado (32)', Number(b.unidadesBase) === 32, `unidadesBase=${b.unidadesBase}`);
  chequear('el unitario se movió de verdad', Number(b.costoMaterialUnit) > Number(a.costoMaterialUnit),
           `$${Number(a.costoMaterialUnit)} (÷40) → $${Number(b.costoMaterialUnit)} (÷32) = ` +
           `${(100 * (Number(b.costoMaterialUnit) / Number(a.costoMaterialUnit) - 1)).toFixed(1)}%`);

  // Dejo la OP como estaba: sin corte y sin costo, que es como está en producción.
  await limpiar();
  await prisma.ordenProduccion.update({
    where: { id: orden.id }, data: { costoTotal: 0, cantidadCortada: null } });
  await prisma.$executeRawUnsafe(`DELETE FROM stock_terminado WHERE sku='${SKU}' AND tipo='liso'`);

  console.log(`\n${fallos === 0 ? '✅ TODO VERDE' : `❌ ${fallos} CHEQUEO(S) EN ROJO`}\n`);
  process.exitCode = fallos === 0 ? 0 : 1;
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
