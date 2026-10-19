// Ejercicio de los avíos al costo y del avío en UNA sola pieza (19-oct-2026), contra la
// copia local. Corre TODO dentro de una transacción que se deshace al final: la copia
// queda como estaba. ⛔ NO correr contra prod.
//
//   DIRECT_URL=postgresql://brunoarevalo@127.0.0.1:5432/areben_test \
//     npx tsx prisma/check-avios-al-costo.ts
//
// El oráculo es la CUENTA A MANO de la bikini (satén $11,07 por pieza, dije $756 sólo en
// la bombacha), leída con SQL crudo y ⛔ con los helpers que se están probando.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { terminarCosturaOrden, CosturaError } from '../lib/produccion/costura';
import { cargarTablero } from '../lib/produccion/tablero';

const url = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
if (!/127\.0\.0\.1|localhost/.test(url)) {
  console.error('⛔ Esto escribe. Apuntá DIRECT_URL a la copia local, no a producción.');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const session = { id: 'check', nombre: 'Ejercicio', rol: 'admin', permisos: [] } as never;
const SKU = 'ZAT-BIK-VER-001';
let fallos = 0;
function chequear(nombre: string, ok: boolean, detalle: string) {
  console.log(`  ${ok ? '✅' : '❌'} ${nombre} — ${detalle}`);
  if (!ok) fallos++;
}
class Deshacer extends Error {}
const cerca = (a: number, b: number) => Math.abs(a - b) < 0.011;

async function preparar(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], parteDije: string) {
  const orden = await tx.ordenProduccion.findUniqueOrThrow({ where: { sku: SKU } });
  await tx.$executeRawUnsafe(`DELETE FROM lotes_corte WHERE "ordenId" = '${orden.id}'`);
  await tx.$executeRawUnsafe(`UPDATE partes_prenda SET "porcentajeMaterial" = CASE nombre WHEN 'Corpiño' THEN 49 ELSE 51 END`);
  await tx.ordenProduccion.update({
    where: { id: orden.id },
    data: { estado: 'COSTURA', terminadoAt: null, cantidadCortada: 40, costoTotal: 100000 },
  });
  const dije = await tx.etiquetaCatalogo.create({ data: { nombre: 'Dije (check)', precio: 756, stock: 100, parte: parteDije } });
  const saten = await tx.etiquetaCatalogo.create({ data: { nombre: 'Satén (check)', precio: 11.07, stock: 100 } });
  await tx.ordenAvio.deleteMany({ where: { ordenId: orden.id } });
  await tx.ordenAvio.createMany({ data: [
    { ordenId: orden.id, etiquetaId: dije.id, cantidad: 1 },
    { ordenId: orden.id, etiquetaId: saten.id, cantidad: 1 },
  ] });
  return { orden, dije, saten };
}

async function main() {
  console.log('\n=== 1. Ingreso de 3 bikinis: el dije sólo en la bombacha, el satén en las dos ===');
  try {
    await prisma.$transaction(async (tx) => {
      const { orden, dije, saten } = await preparar(tx, 'Bombacha');
      const talles = [{ talle: 'S', cantidad: 2 }, { talle: 'M', cantidad: 1 }];
      await terminarCosturaOrden(tx, orden.id, [{ parte: 'Corpiño', talles }, { parte: 'Bombacha', talles }], session, false);

      const lotes = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT parte, "costoMaterialUnit"::float m, "costoAviosUnit"::float a, "costoMoUnit"::float mo, "costoUnitario"::float u
           FROM lotes_corte WHERE "ordenId"='${orden.id}' ORDER BY parte`);
      const de = (p: string) => lotes.find((l) => l.parte === p)!;
      chequear('corpiño: avíos = 1 satén', cerca(Number(de('Corpiño').a), 11.07), `$${de('Corpiño').a}`);
      chequear('bombacha: avíos = satén + dije', cerca(Number(de('Bombacha').a), 767.07), `$${de('Bombacha').a}`);
      chequear('la bikini lleva $778,14 de avíos', cerca(Number(de('Corpiño').a) + Number(de('Bombacha').a), 778.14),
        `$${Number(de('Corpiño').a) + Number(de('Bombacha').a)}`);
      chequear('el material NO cambió (100.000 × 49% ÷ 40)', cerca(Number(de('Corpiño').m), 1225), `$${de('Corpiño').m}`);
      for (const l of lotes) {
        chequear(`${l.parte}: unitario = material + avíos + MO`, cerca(Number(l.u), Number(l.m) + Number(l.a) + Number(l.mo)),
          `${l.u} vs ${l.m} + ${l.a} + ${l.mo}`);
      }

      const st = await tx.$queryRawUnsafe<{ id: string; stock: number }[]>(
        `SELECT id, stock FROM etiqueta_catalogo WHERE id IN ('${dije.id}','${saten.id}')`);
      const stock = (id: string) => st.find((s) => s.id === id)!.stock;
      chequear('dije: descontó 3 (una por bombacha)', stock(dije.id) === 97, `quedan ${stock(dije.id)}`);
      chequear('satén: descontó 6 (una por pieza)', stock(saten.id) === 94, `quedan ${stock(saten.id)}`);

      console.log('\n=== 2. El tablero: material/u con avíos ===');
      const t = await cargarTablero(tx, { conValores: true });
      const o = t.articulos.flatMap((a) => a.ordenes).find((x) => x.sku === SKU)!;
      chequear('avíos por prenda en el tablero', cerca(o.costos!.aviosUnit, 778.14), `$${o.costos!.aviosUnit}`);
      // Material del tablero = (tela + subl + corte de la orden) ÷ cortadas + avíos. Los
      // componentes de esta copia están en 0 (sólo se forzó `costoTotal`): da los avíos solos.
      const comp = Number(orden.costoTela) + Number(orden.costoInsumosSecundarios) + Number(orden.costoSublimacion) + Number(orden.costoCorte);
      chequear('material/u = componentes ÷ 40 + avíos', cerca(o.costos!.materialUnit!, comp / 40 + 778.14), `$${o.costos!.materialUnit}`);
      throw new Deshacer();
    });
  } catch (e) { if (!(e instanceof Deshacer)) throw e; }

  console.log('\n=== 3. Un avío de una pieza que la prenda no tiene: se PLANTA ===');
  let msg = '';
  try {
    await prisma.$transaction(async (tx) => {
      const { orden } = await preparar(tx, 'Pollera');
      await terminarCosturaOrden(tx, orden.id, [{ parte: 'Corpiño', talles: [{ talle: 'S', cantidad: 1 }] }, { parte: 'Bombacha', talles: [{ talle: 'S', cantidad: 1 }] }], session, false);
      throw new Deshacer();
    });
  } catch (e) {
    if (e instanceof CosturaError) msg = e.message;
    else if (!(e instanceof Deshacer)) throw e;
  }
  chequear('se plantó nombrando el avío', msg.includes('Dije (check)') && msg.includes('Pollera'), msg || 'NO se plantó');

  const rastro = await prisma.etiquetaCatalogo.count({ where: { nombre: { endsWith: '(check)' } } });
  chequear('la copia quedó como estaba', rastro === 0, `avíos de prueba que sobrevivieron: ${rastro}`);
  console.log(fallos ? `\n❌ ${fallos} fallaron` : '\n✅ todo verde');
  process.exitCode = fallos ? 1 : 0;
}
main().finally(() => prisma.$disconnect());
