// Ejercicio de los lotes PLANIFICADOS (separar un corte en Lote 1 / Lote 2) contra una
// copia de la base. ⛔ NO correr contra prod: crea órdenes, minutos, lotes y stock.
//
//   DIRECT_URL=postgresql://brunoarevalo@127.0.0.1:5432/areben_test \
//     npx tsx prisma/check-lotes-planificados.ts
//
// Trabaja sobre dos órdenes INVENTADAS (ZAT-BIK-TST-901 y ZAT-TOP-TST-901), que crea y
// borra en cada corrida: los minutos tienen que ser exactamente los que pone el ejercicio,
// o los números esperados no significan nada.
//
// El oráculo se lee con SQL crudo, ⛔ no con los helpers que se están probando. Y el más
// fuerte es la CONSERVACIÓN: lo que se llevaron todos los ingresos de una pieza tiene que
// ser exactamente lo que la tablet registró para esa pieza — ni un minuto contado dos
// veces, ni uno perdido.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { terminarCosturaOrden, CosturaError } from '../lib/produccion/costura';
import { LoteCorteError } from '../lib/produccion/loteCorte';
import { separarLote, deshacerLote, activarSeparacion, ponerEnTaller, lotesParaTablet, registrarFalla, borrarFalla, estadoDeLotes, lotesParaPantalla, LotePlanificadoError } from '../lib/produccion/lotesPlanificados';
import { TerminarCosturaSchema, TerminarLoteSchema, SepararLoteSchema } from '../lib/validators/produccion';
import { TiempoSchema } from '../lib/validators/tiempos';

const url = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
if (!/127\.0\.0\.1|localhost/.test(url)) {
  console.error('⛔ Esto escribe. Apuntá DIRECT_URL a la copia local, no a producción.');
  console.error(`   URL recibida: ${url.replace(/:[^:@/]+@/, ':***@').slice(0, 60)}…`);
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const sql = (q: string) => prisma.$queryRawUnsafe<Record<string, unknown>[]>(q);
let fallos = 0;
function chequear(nombre: string, ok: boolean, detalle: string) {
  console.log(`  ${ok ? '✅' : '❌'} ${nombre} — ${detalle}`);
  if (!ok) fallos++;
}
const cerca = (a: number, b: number) => Math.abs(a - b) < 0.02;

/** Corre algo que TIENE que plantarse y devuelve el mensaje ('' si no se plantó). */
async function plantado(fn: () => Promise<unknown>): Promise<string> {
  try { await fn(); return ''; } catch (e) {
    if (e instanceof CosturaError || e instanceof LoteCorteError || e instanceof LotePlanificadoError) return e.message;
    throw e;
  }
}

const BIK = 'ZAT-BIK-TST-901';
const TOP = 'ZAT-TOP-TST-901';
const PRG = 'ZAT-TOP-TST-903';
const FAL = 'ZAT-BIK-TST-904';
const PIEZAS = ['Corpiño', 'Bombacha'];

async function limpiar() {
  for (const sku of [BIK, TOP, PRG, FAL]) {
    await prisma.$executeRawUnsafe(`DELETE FROM tiempos_produccion WHERE sku = '${sku}'`);
    await prisma.$executeRawUnsafe(
      `DELETE FROM estado_transiciones WHERE "ordenId" IN (SELECT id FROM ordenes_produccion WHERE sku = '${sku}')`);
    await prisma.$executeRawUnsafe(
      `DELETE FROM movimientos_terminado WHERE "ordenId" IN (SELECT id FROM ordenes_produccion WHERE sku = '${sku}')`);
    await prisma.$executeRawUnsafe(`DELETE FROM ordenes_produccion WHERE sku = '${sku}'`);
  }
  await prisma.$executeRawUnsafe(
    `DELETE FROM stock_terminado WHERE sku IN ('${BIK}','${TOP}','${FAL}','ZAT-COR-TST-901','ZAT-BOM-TST-901','ZAT-COR-TST-904','ZAT-BOM-TST-904')`);
}

async function crearOrden(sku: string, talles: Record<string, string>) {
  return prisma.ordenProduccion.create({
    data: {
      sku, descripcion: `Ejercicio lotes planificados ${sku}`, marca: 'Zattia', estado: 'COSTURA',
      cantidad: 60, cantidadCortada: 62, costoTotal: 0,
      fichaCorteData: { talles },
    },
  });
}

/** Un registro de la tablet, pasado por el validador REAL que usa la API. */
async function minutos(sku: string, min: number, parte: string | null, lote: number | null) {
  const datos = TiempoSchema.parse({
    usuario: 'Ejercicio', actividad: 'Proceso Completado', fecha: '2026-10-06', marca: 'Zattia',
    maquina: 'Remalladora', sku, minutosNetos: min, estado: 'guardado',
    ...(parte ? { parte } : {}), ...(lote ? { lote } : {}),
  });
  await prisma.tiemposProduccion.create({ data: datos });
}

const session = (async () => {
  const u = await sql(`SELECT id FROM usuarios LIMIT 1`);
  return { id: String(u[0].id), nombre: 'Ejercicio', rol: 'admin', permisos: [] } as never;
});

async function main() {
  const ses = await session();
  await limpiar();

  // ============ A. Prenda común (TOP): sin lotes, igual que siempre ============
  console.log('\n=== A. Una orden SIN separar cuesta exactamente como antes ===');
  const top = await crearOrden(TOP, { S: '20', M: '22', L: '20' });
  await minutos(TOP, 62, null, null);
  await prisma.$transaction((tx) =>
    terminarCosturaOrden(tx, top.id, [{ parte: null, talles: [{ talle: 'S', cantidad: 10 }] }], ses, true));
  let r = await sql(`SELECT numero, "minutosImputados", "minutosComunes", "lotePlanificadoId" FROM lotes_corte WHERE "ordenId"='${top.id}'`);
  chequear('el 1er ingreso se lleva TODOS los minutos', cerca(Number(r[0]?.minutosImputados), 62),
    `minutosImputados=${r[0]?.minutosImputados} (esperado 62)`);
  chequear('sin lote planificado', r[0]?.lotePlanificadoId === null, `lotePlanificadoId=${r[0]?.lotePlanificadoId}`);

  console.log('\n=== B. Separar DESPUÉS de un ingreso: lo ya entrado pasa al Lote 1, sin contar dos veces ===');
  let msg = await plantado(() => prisma.$transaction((tx) =>
    separarLote(tx, top.id, [{ talle: 'S', cantidad: 11 }], 'Remallado', ses)));
  chequear('no deja separar más de lo que queda sin ingresar', msg.includes('le quedan 10 de talle S'), msg || 'NO se plantó');

  await prisma.$transaction((tx) => separarLote(tx, top.id, [{ talle: 'M', cantidad: 20 }], 'Remallado', ses));
  r = await sql(`SELECT lp.numero, string_agg(t.talle || '=' || t.cantidad, ',' ORDER BY t.talle) AS talles
                 FROM lotes_planificados lp JOIN lotes_planificados_talles t ON t."loteId"=lp.id
                 WHERE lp."ordenId"='${top.id}' GROUP BY lp.numero ORDER BY lp.numero`);
  chequear('Lote 1 = L20 · M2 · S20', r[0]?.talles === 'L=20,M=2,S=20', `Lote 1: ${r[0]?.talles}`);
  chequear('Lote 2 = M20', r[1]?.talles === 'M=20', `Lote 2: ${r[1]?.talles}`);
  r = await sql(`SELECT lc."minutosComunes", lp.numero FROM lotes_corte lc JOIN lotes_planificados lp ON lp.id=lc."lotePlanificadoId"
                 WHERE lc."ordenId"='${top.id}'`);
  chequear('el ingreso viejo quedó en el Lote 1, con sus 62 como comunes',
    Number(r[0]?.numero) === 1 && cerca(Number(r[0]?.minutosComunes), 62), JSON.stringify(r));

  await minutos(TOP, 10, null, 2);
  const lotesTop = await sql(`SELECT id, numero FROM lotes_planificados WHERE "ordenId"='${top.id}' ORDER BY numero`);
  await prisma.$transaction((tx) => terminarCosturaOrden(tx, top.id,
    [{ parte: null, talles: [{ talle: 'M', cantidad: 20 }] }], ses, true, String(lotesTop[1].id)));
  r = await sql(`SELECT "minutosImputados", "minutosComunes" FROM lotes_corte WHERE "lotePlanificadoId"='${lotesTop[1].id}'`);
  chequear('el Lote 2 se lleva SÓLO sus 10: la bolsa común ya la había vaciado el ingreso viejo',
    cerca(Number(r[0]?.minutosImputados), 10) && cerca(Number(r[0]?.minutosComunes), 0),
    `imputados=${r[0]?.minutosImputados} comunes=${r[0]?.minutosComunes} (esperado 10 y 0)`);
  r = await sql(`SELECT sum("minutosImputados")::float AS s FROM lotes_corte WHERE "ordenId"='${top.id}'`);
  chequear('CONSERVACIÓN: 62 + 10 registrados = 72 imputados', cerca(Number(r[0].s), 72), `suma=${r[0].s}`);

  console.log('\n=== C. Talles del corte que no suman lo cortado: se planta ===');
  const malo = await prisma.ordenProduccion.create({
    data: { sku: 'ZAT-TOP-TST-902', descripcion: 'malo', marca: 'Zattia', estado: 'COSTURA', cantidad: 62,
            cantidadCortada: 62, fichaCorteData: { talles: { S: '30', M: '30' } } },
  });
  msg = await plantado(() => prisma.$transaction((tx) =>
    separarLote(tx, malo.id, [{ talle: 'S', cantidad: 5 }], 'Remallado', ses)));
  chequear('se planta', msg.includes('suman 60') && msg.includes('62 cortadas'), msg || 'NO se plantó');
  await prisma.ordenProduccion.delete({ where: { id: malo.id } });

  // ============ D. La AYLA: bikini por piezas, separada después del remallado ============
  console.log('\n=== D. Bikini (por piezas): separar desde la ficha de corte, sin cortes_por_talle ===');
  const bik = await crearOrden(BIK, { S: '26', M: '26', L: '10' });
  // Antes de separar (sin lote): 62 min de corpiño, 62 de bombacha y 124 sin pieza.
  await minutos(BIK, 62, 'Corpiño', null);
  await minutos(BIK, 62, 'Bombacha', null);
  await minutos(BIK, 124, null, null);

  // Un lote 3 de prueba, para ejercer el deshacer, y se deshace antes de que pese.
  await prisma.$transaction((tx) => separarLote(tx, bik.id, [{ talle: 'S', cantidad: 10 }, { talle: 'M', cantidad: 10 }], 'Remallado', ses));
  await prisma.$transaction((tx) => separarLote(tx, bik.id, [{ talle: 'L', cantidad: 2 }], 'Collareta', ses));
  msg = await plantado(() => prisma.$transaction((tx) => deshacerLote(tx, bik.id, 2, ses)));
  chequear('sólo se deshace el ÚLTIMO', msg.includes('último'), msg || 'NO se plantó');
  await prisma.$transaction((tx) => deshacerLote(tx, bik.id, 3, ses));
  r = await sql(`SELECT lp.numero, string_agg(t.talle || '=' || t.cantidad, ',' ORDER BY t.talle) AS talles
                 FROM lotes_planificados lp JOIN lotes_planificados_talles t ON t."loteId"=lp.id
                 WHERE lp."ordenId"='${bik.id}' GROUP BY lp.numero ORDER BY lp.numero`);
  chequear('deshacer devuelve al Lote 1: L10 · M16 · S16', r.length === 2 && r[0]?.talles === 'L=10,M=16,S=16',
    r.map((x) => `Lote ${x.numero}: ${x.talles}`).join(' | '));
  chequear('Lote 2 = S10 · M10', r[1]?.talles === 'M=10,S=10', `Lote 2: ${r[1]?.talles}`);
  r = await sql(`SELECT notas FROM estado_transiciones WHERE "ordenId"='${bik.id}' ORDER BY fecha`);
  chequear('la separación queda en el historial',
    String(r[0]?.notas).startsWith('Separado Lote 2 (S 10 · M 10 = 20 u) después de Remallado'), String(r[0]?.notas));

  // Después de separar: la tablet marca el lote.
  await minutos(BIK, 30, 'Corpiño', 2);
  await minutos(BIK, 21, 'Bombacha', 1);
  await minutos(BIK, 10, null, 2);
  msg = await plantado(() => prisma.$transaction((tx) => deshacerLote(tx, bik.id, 2, ses)));
  chequear('con minutos de la tablet marcados (sin ingresos), no se deshace', msg.includes('marcados con el Lote 2'), msg || 'NO se plantó');
  const lotesBik = await sql(`SELECT id, numero FROM lotes_planificados WHERE "ordenId"='${bik.id}' ORDER BY numero`);
  const [l1, l2] = [String(lotesBik[0].id), String(lotesBik[1].id)];
  const piezas = (talles: { talle: string; cantidad: number }[]) => PIEZAS.map((parte) => ({ parte, talles }));

  console.log('\n=== E. El ingreso de una orden separada tiene que decir el lote, y caber en él ===');
  msg = await plantado(() => prisma.$transaction((tx) =>
    terminarCosturaOrden(tx, bik.id, piezas([{ talle: 'S', cantidad: 10 }]), ses, true)));
  chequear('sin lote, se planta', msg.includes('elegí en cuál entra'), msg || 'NO se plantó');
  msg = await plantado(() => prisma.$transaction((tx) =>
    terminarCosturaOrden(tx, bik.id, piezas([{ talle: 'S', cantidad: 11 }]), ses, true, l2)));
  chequear('más de lo que tiene el lote, se planta', msg.includes('tiene 10 de talle S'), msg || 'NO se plantó');
  msg = await plantado(() => prisma.$transaction((tx) =>
    terminarCosturaOrden(tx, bik.id, piezas([{ talle: 'L', cantidad: 1 }]), ses, true, l2)));
  chequear('un talle que el lote no tiene, se planta', msg.includes('tiene 0 de talle L'), msg || 'NO se plantó');
  msg = await plantado(() => prisma.$transaction((tx) =>
    terminarCosturaOrden(tx, top.id, [{ parte: null, talles: [{ talle: 'S', cantidad: 1 }] }], ses, true, l2)));
  chequear('un lote de OTRA orden, se planta', msg.includes('no es de'), msg || 'NO se plantó');

  console.log('\n=== F. El Lote 2 entra PRIMERO y se llama Lote 2 ===');
  await prisma.$transaction((tx) =>
    terminarCosturaOrden(tx, bik.id, piezas([{ talle: 'S', cantidad: 10 }, { talle: 'M', cantidad: 10 }]), ses, true, l2));
  r = await sql(`SELECT parte, numero, unidades, "minutosImputados"::float AS mi, "minutosCompartidos"::float AS mc,
                        "minutosComunes"::float AS mco FROM lotes_corte WHERE "lotePlanificadoId"='${l2}' ORDER BY parte`);
  const bom2 = r.find((x) => x.parte === 'Bombacha'); const cor2 = r.find((x) => x.parte === 'Corpiño');
  // Corpiño: propios 30 + 10/2 = 35, comunes (62 + 124/2) × 20/62 = 40 ⇒ 75; no medidos 5 + 62×20/62 = 25.
  chequear('Corpiño del Lote 2: 35 propios + 40 comunes = 75',
    cerca(Number(cor2?.mi), 75) && cerca(Number(cor2?.mco), 40) && cerca(Number(cor2?.mc), 25),
    `imputados=${cor2?.mi} comunes=${cor2?.mco} compartidos=${cor2?.mc}`);
  // Bombacha: propios 0 + 5 = 5 (los 21 de bombacha son del Lote 1), comunes 40 ⇒ 45.
  chequear('Bombacha del Lote 2: 5 propios + 40 comunes = 45 (los 21 del Lote 1 NO)',
    cerca(Number(bom2?.mi), 45) && cerca(Number(bom2?.mco), 40), `imputados=${bom2?.mi} comunes=${bom2?.mco}`);
  r = await sql(`SELECT notas FROM estado_transiciones WHERE "ordenId"='${bik.id}' ORDER BY fecha DESC LIMIT 1`);
  chequear('el historial dice "Lote 2 de 2"', String(r[0]?.notas).startsWith('Lote 2 de 2:'), String(r[0]?.notas));
  r = await sql(`SELECT estado FROM ordenes_produccion WHERE id='${bik.id}'`);
  chequear('con 20 de 62 sigue en COSTURA', r[0].estado === 'COSTURA', `estado=${r[0].estado}`);

  console.log('\n=== G. El Lote 1 en dos ingresos, y la orden cierra al llegar a 62 ===');
  await prisma.$transaction((tx) =>
    terminarCosturaOrden(tx, bik.id, piezas([{ talle: 'S', cantidad: 16 }, { talle: 'M', cantidad: 5 }]), ses, true, l1));
  r = await sql(`SELECT parte, "minutosImputados"::float AS mi, "minutosComunes"::float AS mco
                 FROM lotes_corte WHERE "lotePlanificadoId"='${l1}' ORDER BY parte`);
  // Comunes del Lote 1: 124 × 42/62 = 84 por pieza. Bombacha suma sus 21 propios.
  chequear('Corpiño del Lote 1: 84 comunes', cerca(Number(r.find((x) => x.parte === 'Corpiño')?.mi), 84),
    JSON.stringify(r.find((x) => x.parte === 'Corpiño')));
  chequear('Bombacha del Lote 1: 21 propios + 84 comunes = 105', cerca(Number(r.find((x) => x.parte === 'Bombacha')?.mi), 105),
    JSON.stringify(r.find((x) => x.parte === 'Bombacha')));

  await prisma.$transaction((tx) =>
    terminarCosturaOrden(tx, bik.id, piezas([{ talle: 'M', cantidad: 11 }, { talle: 'L', cantidad: 10 }]), ses, true, l1));
  r = await sql(`SELECT sum("minutosImputados")::float AS s FROM lotes_corte
                 WHERE "lotePlanificadoId"='${l1}' AND "ingresadoAt" = (SELECT max("ingresadoAt") FROM lotes_corte WHERE "ordenId"='${bik.id}')`);
  chequear('el 2º ingreso del Lote 1 no encuentra nada más que llevarse', cerca(Number(r[0].s), 0), `minutos=${r[0].s}`);
  r = await sql(`SELECT estado FROM ordenes_produccion WHERE id='${bik.id}'`);
  chequear('con 62 de 62 la orden TERMINÓ', r[0].estado === 'TERMINADO_SIN_ESTAMPA', `estado=${r[0].estado}`);

  // El oráculo fuerte: cada minuto registrado de cada pieza se imputó UNA vez.
  // Corpiño: 62 + 124/2 + 30 + 10/2 = 159 · Bombacha: 62 + 62 + 21 + 5 = 150.
  r = await sql(`SELECT parte, sum("minutosImputados")::float AS s FROM lotes_corte WHERE "ordenId"='${bik.id}' GROUP BY parte ORDER BY parte`);
  chequear('CONSERVACIÓN Corpiño: 159 registrados = 159 imputados', cerca(Number(r.find((x) => x.parte === 'Corpiño')?.s), 159), JSON.stringify(r));
  chequear('CONSERVACIÓN Bombacha: 150 registrados = 150 imputados', cerca(Number(r.find((x) => x.parte === 'Bombacha')?.s), 150), JSON.stringify(r));
  r = await sql(`SELECT sku, sum(cantidad)::int AS n FROM stock_terminado WHERE sku IN ('ZAT-COR-TST-901','ZAT-BOM-TST-901') GROUP BY sku`);
  chequear('entraron 62 de cada pieza al stock', r.length === 2 && r.every((x) => Number(x.n) === 62), JSON.stringify(r));

  console.log('\n=== H. Deshacer un lote con minutos marcados: se planta ===');
  await prisma.ordenProduccion.update({ where: { id: top.id }, data: { estado: 'COSTURA' } });
  msg = await plantado(() => prisma.$transaction((tx) => deshacerLote(tx, top.id, 2, ses)));
  chequear('con ingresos o minutos, no se deshace', msg.length > 0, msg || 'NO se plantó');

  console.log('\n=== I. Los validadores REALES aceptan lo que mandan las pantallas ===');
  const p1 = TerminarCosturaSchema.safeParse({ conteos: piezas([{ talle: 'S', cantidad: 1 }]), permitirSinCosto: false, lotePlanificadoId: l2 });
  chequear('modal por OP con lote', p1.success && p1.data.lotePlanificadoId === l2, JSON.stringify(p1.success ? p1.data.lotePlanificadoId : p1.error.issues));
  const p2 = TerminarCosturaSchema.safeParse({ conteos: piezas([{ talle: 'S', cantidad: 1 }]) });
  chequear('modal por OP sin lote (orden sin separar)', p2.success && p2.data.lotePlanificadoId === null, JSON.stringify(p2.success));
  const p3 = TerminarLoteSchema.safeParse({ colores: [{ ordenId: bik.id, conteos: piezas([{ talle: 'S', cantidad: 1 }]), lotePlanificadoId: l1 }] });
  chequear('form por color con lote', p3.success && p3.data.colores[0].lotePlanificadoId === l1, JSON.stringify(p3.success));
  const p4 = SepararLoteSchema.safeParse({ talles: [{ talle: 'S', cantidad: 10 }, { talle: 'L', cantidad: 0 }], despuesDe: 'Remallado' });
  chequear('separar', p4.success, JSON.stringify(p4.success ? 'ok' : p4.error.issues));
  const p5 = TiempoSchema.safeParse({ usuario: 'x', actividad: 'Proceso Completado', fecha: '2026-10-06', lote: 2 });
  chequear('tablet con lote', p5.success && p5.data.lote === 2, JSON.stringify(p5.success));

  // ============ J. Separación PROGRAMADA: espera que la costurera deje la remalladora ============
  console.log('\n=== J. Programar al cargar el corte, activar desde la tablet, una fila por lote visible ===');
  const prg = await prisma.ordenProduccion.create({
    data: { sku: PRG, descripcion: 'programada', marca: 'Zattia', estado: 'CORTE', cantidad: 40, cantidadCortada: 40,
            fichaCorteData: { talles: { S: '20', M: '20' } } },
  });
  const tablet = async () => (await lotesParaTablet(prisma, [{ id: prg.id, sku: PRG }])).get(prg.id);
  msg = await plantado(() => prisma.$transaction((tx) => separarLote(tx, prg.id, [{ talle: 'S', cantidad: 5 }], 'Todo cortado', ses, true)));
  chequear('"Todo cortado" no se programa', msg.includes('no se programa'), msg || 'NO se plantó');
  msg = await plantado(() => prisma.$transaction((tx) => separarLote(tx, prg.id, [{ talle: 'S', cantidad: 5 }], 'Remallado', ses)));
  chequear('separar YA en CORTE no se puede', msg.includes('no está en costura'), msg || 'NO se plantó');
  await prisma.$transaction((tx) => separarLote(tx, prg.id, [{ talle: 'S', cantidad: 5 }, { talle: 'M', cantidad: 5 }], 'Remallado', ses, true));
  r = await sql(`SELECT numero, "activadoAt" IS NULL AS programado, "enTaller" FROM lotes_planificados WHERE "ordenId"='${prg.id}' ORDER BY numero`);
  chequear('programado en CORTE: los dos lotes esperan', r.length === 2 && r.every((x) => x.programado === true), JSON.stringify(r));
  chequear('Lote 1 en el taller, Lote 2 afuera', r[0]?.enTaller === true && r[1]?.enTaller === false, JSON.stringify(r));
  await prisma.ordenProduccion.update({ where: { id: prg.id }, data: { estado: 'COSTURA' } });
  let t = await tablet();
  chequear('mientras espera, la tablet NO muestra lotes y pregunta por el Remallado',
    t?.lotes.length === 0 && t?.confirmarDespuesDe === 'Remallado', JSON.stringify(t));
  msg = await plantado(() => prisma.$transaction((tx) => separarLote(tx, prg.id, [{ talle: 'S', cantidad: 1 }], 'Recta', ses)));
  chequear('con una programada, no se separa otra ya', msg.includes('programada'), msg || 'NO se plantó');
  await prisma.$transaction((tx) => activarSeparacion(tx, prg.id, ses, 'tablet'));
  t = await tablet();
  chequear('confirmado: la tablet muestra el Lote 1 (el 2 nace oculto) y ya no pregunta',
    JSON.stringify(t?.lotes) === '[1]' && t?.confirmarDespuesDe === null, JSON.stringify(t));
  r = await sql(`SELECT notas FROM estado_transiciones WHERE "ordenId"='${prg.id}' ORDER BY fecha DESC LIMIT 1`);
  chequear('el historial dice quién confirmó y qué', String(r[0]?.notas).includes('confirmó desde la tablet que terminó Remallado'), String(r[0]?.notas));
  msg = await plantado(() => prisma.$transaction((tx) => activarSeparacion(tx, prg.id, ses, 'tablet')));
  chequear('confirmar dos veces no hace nada', msg.includes('no tiene una separación esperando'), msg || 'NO se plantó');
  await prisma.$transaction((tx) => ponerEnTaller(tx, prg.id, 2, true, ses));
  t = await tablet();
  chequear('los dos visibles: la tablet muestra LOS DOS (una fila cada uno)', JSON.stringify(t?.lotes) === '[1,2]', JSON.stringify(t));
  await prisma.$transaction((tx) => ponerEnTaller(tx, prg.id, 1, false, ses));
  t = await tablet();
  chequear('ocultan el Lote 1: queda sólo el Lote 2', JSON.stringify(t?.lotes) === '[2]', JSON.stringify(t));
  await prisma.$transaction((tx) => ponerEnTaller(tx, prg.id, 2, false, ses));
  t = await tablet();
  chequear('todos ocultos: ninguna fila', t?.lotes.length === 0, JSON.stringify(t));
  const p6 = SepararLoteSchema.safeParse({ talles: [{ talle: 'S', cantidad: 1 }], despuesDe: 'Remallado', programado: true });
  chequear('validador de separar con programado', p6.success && p6.data.programado === true, JSON.stringify(p6.success));

  // ============ K. FALLAS: piezas perdidas que el lote deja de esperar ============
  console.log('\n=== K. Fallas: 3 bombachas M perdidas en el remallado del Lote 2 ===');
  const fal = await crearOrden(FAL, { S: '10', M: '10' });
  await prisma.ordenProduccion.update({ where: { id: fal.id }, data: { cantidad: 20, cantidadCortada: 20 } });
  await prisma.$transaction((tx) => separarLote(tx, fal.id, [{ talle: 'M', cantidad: 5 }], 'Remallado', ses));
  const lf = await sql(`SELECT id, numero FROM lotes_planificados WHERE "ordenId"='${fal.id}' ORDER BY numero`);
  const [f1, f2] = [String(lf[0].id), String(lf[1].id)];
  msg = await plantado(() => prisma.$transaction((tx) =>
    registrarFalla(tx, fal.id, { numero: 2, parte: null, talle: 'M', cantidad: 1, proceso: 'Remallado' }, ses)));
  chequear('en la bikini, sin pieza se planta', msg.includes('Elegí la pieza'), msg || 'NO se plantó');
  msg = await plantado(() => prisma.$transaction((tx) =>
    registrarFalla(tx, fal.id, { numero: 2, parte: 'Bombacha', talle: 'S', cantidad: 1, proceso: 'Remallado' }, ses)));
  chequear('un talle que el lote no tiene, se planta', msg.includes('no tiene talle S'), msg || 'NO se plantó');
  msg = await plantado(() => prisma.$transaction((tx) =>
    registrarFalla(tx, fal.id, { numero: 2, parte: 'Bombacha', talle: 'M', cantidad: 6, proceso: 'Remallado' }, ses)));
  chequear('más de las que quedan, se planta', msg.includes('le quedan 5'), msg || 'NO se plantó');
  await prisma.$transaction((tx) =>
    registrarFalla(tx, fal.id, { numero: 2, parte: 'Bombacha', talle: 'M', cantidad: 3, proceso: 'Remallado', motivo: 'se cortó la tela' }, ses));
  r = await sql(`SELECT parte, talle, cantidad, proceso FROM fallas_lote WHERE "loteId"='${f2}'`);
  chequear('la falla quedó en el Lote 2 (oráculo: SQL)', r.length === 1 && r[0].parte === 'Bombacha' && r[0].talle === 'M' && Number(r[0].cantidad) === 3, JSON.stringify(r));
  let dto = lotesParaPantalla(await estadoDeLotes(prisma, fal)).find((l) => l.numero === 2)!;
  chequear('el Lote 2 espera 5 corpiños y 2 bombachas', dto.esperadoPorParte['Corpiño'] === 5 && dto.esperadoPorParte['Bombacha'] === 2, JSON.stringify(dto.esperadoPorParte));
  chequear('el ingreso propone Bombacha M = 2 y Corpiño M = 5',
    dto.pendientePorParte['Bombacha']?.find((t) => t.talle === 'M')?.cantidad === 2 &&
    dto.pendientePorParte['Corpiño']?.find((t) => t.talle === 'M')?.cantidad === 5, JSON.stringify(dto.pendientePorParte));
  r = await sql(`SELECT notas FROM estado_transiciones WHERE "ordenId"='${fal.id}' ORDER BY fecha DESC LIMIT 1`);
  chequear('el historial dice la falla', String(r[0]?.notas).startsWith('Falla en el Lote 2: 3 bombachas talle M, en Remallado (se cortó la tela)'), String(r[0]?.notas));
  msg = await plantado(() => prisma.$transaction((tx) => deshacerLote(tx, fal.id, 2, ses)));
  chequear('un lote con fallas no se deshace', msg.includes('tiene fallas registradas'), msg || 'NO se plantó');
  // La que tiene una pieza fallada se queda en su lote: del Lote 1 M (5) con 1 bombacha fallada se separan 4, no 5.
  await prisma.$transaction((tx) =>
    registrarFalla(tx, fal.id, { numero: 1, parte: 'Bombacha', talle: 'M', cantidad: 1, proceso: 'Collareta' }, ses));
  msg = await plantado(() => prisma.$transaction((tx) => separarLote(tx, fal.id, [{ talle: 'M', cantidad: 5 }], 'Recta', ses)));
  chequear('separar no se lleva la prenda con la pieza fallada', msg.includes('le quedan 4 de talle M'), msg || 'NO se plantó');
  const idF1 = String((await sql(`SELECT id FROM fallas_lote WHERE "loteId"='${f1}'`))[0].id);
  await prisma.$transaction((tx) => borrarFalla(tx, fal.id, idF1, ses));
  dto = lotesParaPantalla(await estadoDeLotes(prisma, fal)).find((l) => l.numero === 1)!;
  chequear('borrar la falla: el Lote 1 vuelve a esperar 15 bombachas', dto.esperadoPorParte['Bombacha'] === 15 && dto.fallas.length === 0, JSON.stringify(dto.esperadoPorParte));
  msg = await plantado(() => prisma.$transaction((tx) =>
    terminarCosturaOrden(tx, fal.id, piezas([{ talle: 'M', cantidad: 3 }]), ses, true, f2)));
  chequear('ingresar 3 bombachas M al Lote 2 (espera 2), se planta y dice la falla', msg.includes('tiene 2 de talle M para ingresar (3 falladas)'), msg || 'NO se plantó');
  await prisma.$transaction((tx) => terminarCosturaOrden(tx, fal.id, [
    { parte: 'Corpiño', talles: [{ talle: 'M', cantidad: 5 }] },
    { parte: 'Bombacha', talles: [{ talle: 'M', cantidad: 2 }] },
  ], ses, true, f2));
  dto = lotesParaPantalla(await estadoDeLotes(prisma, fal)).find((l) => l.numero === 2)!;
  chequear('5 corpiños + 2 bombachas: el Lote 2 CIERRA', dto.abierto === false, JSON.stringify({ ingresado: dto.ingresado, abierto: dto.abierto }));
  r = await sql(`SELECT estado FROM ordenes_produccion WHERE id='${fal.id}'`);
  chequear('con el Lote 1 todavía abierto, la orden sigue en COSTURA', r[0].estado === 'COSTURA', String(r[0].estado));
  await prisma.$transaction((tx) => terminarCosturaOrden(tx, fal.id, piezas([{ talle: 'S', cantidad: 10 }, { talle: 'M', cantidad: 5 }]), ses, true, f1));
  r = await sql(`SELECT estado FROM ordenes_produccion WHERE id='${fal.id}'`);
  chequear('entra el Lote 1 entero: la orden TERMINA aunque entraron 17 bombachas de 20 cortadas', r[0].estado === 'TERMINADO_SIN_ESTAMPA', String(r[0].estado));

  await limpiar();
  console.log(`\n${fallos === 0 ? '✅ TODO VERDE' : `❌ ${fallos} FALLO(S)`}`);
  process.exitCode = fallos === 0 ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
