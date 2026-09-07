// Los dos escandallos que faltaban: la remera BOXY blanca y negra. Sin ellos, MADE,
// TIME y STARRY (42 prendas de la orden de lanzamiento) no tenían costo: el sistema
// no sabía cuánto vale la remera boxy lisa.
//
// 🔴 EL CONSUMO DE TELA ES ESTIMADO, NO MEDIDO, y por eso se marca en tres lugares que
// se ven —el nombre, las notas y el nombre de la tela—: un número cargado sin marca
// pasa por medido, y éste no lo es.
//
// De dónde sale: Bruno (7-sep-2026) dio la relación de su planilla — la oversize $9.400
// y la boxy $9.000 ⇒ la boxy sale 4,26% menos. Todo lo demás (corte, tizada, lavadero,
// minutos, avíos) es idéntico entre las dos: mismo taller, mismas operaciones. Así que
// la única variable es la TELA, y el script la DESPEJA en vez de tipearla: busca el
// consumo que hace que el total dé 0,9574 del de la oversize del mismo color.
//
// ⚠️ Lo que hay que verificar cuando alguien tenga la prenda en la mano: si la boxy no
// consume ~0,89 m, este costo está mal en la misma proporción. La boxy de Zattia gasta
// 0,70 m, bastante menos — pero es otro molde y otra marca, así que no sirve de oráculo.
//
//   npx tsx prisma/migrate-escandallo-remera-boxy.ts            → sólo informa
//   npx tsx prisma/migrate-escandallo-remera-boxy.ts --aplicar  → escribe
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { parseDatos, calcular, type DatosEscandallo } from '../lib/costos/escandallo';
import { calcularCostoMinuto } from '../lib/costoMinuto';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
const APLICAR = process.argv.includes('--aplicar');
const RATIO = 9000 / 9400; // la relación de la planilla de Bruno
const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-AR');

const PARES = [
  { origen: 'STU-REM-OVER-BL', destino: 'STU-REM-BOXY-BL', color: 'blanca' },
  { origen: 'STU-REM-OVER-NG', destino: 'STU-REM-BOXY-NG', color: 'negra' },
];

/** El consumo de tela principal que hace que el total dé `objetivo`. Se despeja, no se tipea. */
function despejarConsumo(d: DatosEscandallo, costoMinuto: number, objetivo: number): number {
  const M = { margenDesarrollo: d.margenDesarrollo, margenFallas: d.margenFallas };
  let lo = 0, hi = d.telas[0].consumoMetros;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const total = calcular({ ...d, telas: [{ ...d.telas[0], consumoMetros: mid }, ...d.telas.slice(1)] }, costoMinuto, M).costoTotal;
    if (total > objetivo) hi = mid; else lo = mid;
  }
  return Math.round(((lo + hi) / 2) * 1000) / 1000;
}

async function main() {
  const costoMinuto = await calcularCostoMinuto();
  console.log(`costoMinuto $${costoMinuto.toFixed(2)} · relación boxy/oversize ${RATIO.toFixed(4)} (los $9.000 contra $9.400 de la planilla)\n`);

  for (const par of PARES) {
    const ya = await prisma.escandallo.findFirst({ where: { sku: par.destino } });
    if (ya) { console.log(`⛔ ${par.destino} ya tiene escandallo: no se pisa`); continue; }
    const origen = await prisma.escandallo.findFirst({ where: { sku: par.origen } });
    if (!origen) { console.log(`⛔ falta el escandallo origen ${par.origen}`); continue; }

    const d = parseDatos(origen.datos);
    const M = { margenDesarrollo: d.margenDesarrollo, margenFallas: d.margenFallas };
    const totalOrigen = calcular(d, costoMinuto, M).costoTotal;
    const consumo = despejarConsumo(d, costoMinuto, totalOrigen * RATIO);

    const datos: DatosEscandallo = {
      ...d,
      telas: [{ ...d.telas[0], nombre: 'Tela principal (consumo ESTIMADO)', consumoMetros: consumo }, ...d.telas.slice(1)],
      costoTelaFicha: undefined, // no hay ficha de producción: la boxy nunca pasó por una OP
    };
    const total = calcular(datos, costoMinuto, M).costoTotal;
    const merma = d.telas[0].consumoMetros;
    console.log(`${par.destino} (${par.color}): copia de ${par.origen} con ${consumo} m en vez de ${merma} m (−${(((merma - consumo) / merma) * 100).toFixed(1)}%)`);
    console.log(`   ${$(totalOrigen)} → ${$(total)}  (${((total / totalOrigen - 1) * 100).toFixed(2)}%, márgenes ${M.margenDesarrollo}/${M.margenFallas})`);

    if (APLICAR) {
      await prisma.escandallo.create({
        data: {
          nombre: 'Remera boxy (consumo de tela ESTIMADO)',
          sku: par.destino,
          marca: origen.marca,
          tipoPrenda: origen.tipoPrenda,
          notas: `⚠️ CONSUMO DE TELA ESTIMADO, no medido — ${consumo} m.\n`
               + `Sale de la relación de la planilla de Bruno (7-sep-2026): la oversize $9.400 y la boxy $9.000, o sea 4,26% menos. `
               + `El resto (corte, tizada, lavadero, minutos, avíos) es copia de ${par.origen}: mismo taller y mismas operaciones, así que toda la diferencia se cargó a la tela.\n`
               + `La boxy nunca pasó por una OP, así que no hay consumo medido en el sistema. `
               + `Cuando alguien tenga la prenda en la mano y mida los metros, actualizar acá y sacar esta nota.`,
          datos: JSON.stringify(datos),
        },
      });
    }
  }
  console.log(APLICAR ? '\n✅ aplicado' : '\n(dry-run: agregar --aplicar para escribir)');
}
main().finally(() => prisma.$disconnect());
