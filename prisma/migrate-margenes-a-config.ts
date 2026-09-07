// Lleva los márgenes CONGELADOS de los escandallos a los de `config_costos`.
//
// El margen se decide UNA vez, en la configuración; el escandallo lo FOTOGRAFÍA al
// guardarse. El congelado se conserva —existe para que un pasaje ya cerrado no se mueva
// porque alguien tocó la config el mes que viene— pero tiene que ser una foto de la
// config, no una segunda opinión.
//
// Medido antes de correr (7-sep-2026): 51 de 60 escandallos van 10/5, igual que la config
// desde el 17-jul. Los 9 que van 5/3 son exactamente los cargados el 25-ago, y están en
// LAS DOS marcas (7 Stunned + 2 Zattia) ⇒ no es un criterio de marca, es una tanda.
// ⚠️ El código de hoy no tiene ningún camino que escriba 5/3: el editor estampa la config
// y `parseDatos` cae en 10. De dónde salió ese día, no se pudo determinar.
//
// ⛔ No toca `pasaje_items`: ahí el costo ya está congelado por ítem (hoy: 0 filas).
// ⛔ No mueve `/costos/estampados`, que ya calculaba con los márgenes de config.
// Sí mueve la ficha y el PDF de esos 9, que es justamente lo que estaba discrepando.
//
//   npx tsx prisma/migrate-margenes-a-config.ts            → sólo informa
//   npx tsx prisma/migrate-margenes-a-config.ts --aplicar  → escribe
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { parseDatos, calcular } from '../lib/costos/escandallo';
import { calcularCostoMinuto } from '../lib/costoMinuto';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
const APLICAR = process.argv.includes('--aplicar');
const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-AR');

async function main() {
  const cfg = await prisma.configCostos.upsert({ where: { id: 'singleton' }, create: { id: 'singleton' }, update: {} });
  const M = { margenDesarrollo: cfg.margenDesarrollo, margenFallas: cfg.margenFallas };
  const costoMinuto = await calcularCostoMinuto();
  console.log(`config: ${M.margenDesarrollo}/${M.margenFallas} · costoMinuto $${costoMinuto.toFixed(2)}\n`);

  const escandallos = await prisma.escandallo.findMany({ orderBy: [{ marca: 'asc' }, { sku: 'asc' }] });
  let tocados = 0;
  for (const e of escandallos) {
    const d = parseDatos(e.datos);
    if (d.margenDesarrollo === M.margenDesarrollo && d.margenFallas === M.margenFallas) continue;
    const antes = calcular(d, costoMinuto, { margenDesarrollo: d.margenDesarrollo, margenFallas: d.margenFallas }).costoTotal;
    const despues = calcular(d, costoMinuto, M).costoTotal;
    console.log(`${(e.marca ?? '—').padEnd(8)} ${(e.sku ?? '—').padEnd(24)} ${d.margenDesarrollo}/${d.margenFallas} → ${M.margenDesarrollo}/${M.margenFallas}   ${$(antes).padStart(9)} → ${$(despues).padStart(9)}  (${(((despues / antes) - 1) * 100).toFixed(1)}%)`);
    tocados++;
    if (APLICAR) {
      const datos = { ...d, margenDesarrollo: M.margenDesarrollo, margenFallas: M.margenFallas };
      await prisma.escandallo.update({ where: { id: e.id }, data: { datos: JSON.stringify(datos) } });
    }
  }
  const items = await prisma.pasajeItem.count();
  console.log(`\n${tocados} escandallo(s) de ${escandallos.length} · pasaje_items: ${items} (su costo está congelado por ítem, no se mueve)`);
  console.log(APLICAR ? '✅ aplicado' : '(dry-run: agregar --aplicar para escribir)');
}
main().finally(() => prisma.$disconnect());
