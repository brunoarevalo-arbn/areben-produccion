// Carga los MINUTOS de estampería, que hasta hoy iban en 0 en los 13 de Stunned. Un 0 ahí
// no dice «falta el dato»: AFIRMA que estampar sale gratis, y eso es peor que un número
// aproximado con la palabra «aproximado» al lado.
//
// Bruno (7-sep-2026): **~5 PLANCHADOS por hora ⇒ 12 min cada uno**. Planchados, no prendas:
// una prenda de dos caras lleva DOS planchados y por lo tanto 24 min. La diferencia entre
// leerlo de una forma u otra eran $123.750 contra $247.500 en la orden de 149.
//
// 🔑 Todo lo que se carga queda marcado `minEstimado: true`, incluidos los 6 min que ya
// tenían los 19 de Zattia: `tiempos_estampado` está VACÍO (0 tandas), así que **ninguno**
// de los minutos del sistema está medido. Marcar sólo los nuevos habría hecho parecer
// medidos a los viejos. La marca se apaga sola al traer el valor del sistema de tiempos.
//
//   npx tsx prisma/migrate-minutos-estampado-estimados.ts            → sólo informa
//   npx tsx prisma/migrate-minutos-estampado-estimados.ts --aplicar  → escribe
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
const APLICAR = process.argv.includes('--aplicar');
const MIN_POR_PLANCHADO = 12; // 5 planchados/hora

interface Linea { estampaId: string; tamano?: number; minutosEstampado?: number; minEstimado?: boolean; costoEstampado?: number }

async function main() {
  const tandas = await prisma.tiemposEstampado.count();
  if (tandas > 0) {
    console.log(`⛔ hay ${tandas} tanda(s) medida(s) en tiempos_estampado: NO pisar con una estimación.`);
    console.log('   Traer el valor real desde /costos/estampados con el ↓.');
    await prisma.$disconnect(); return;
  }
  console.log('tiempos_estampado: 0 tandas ⇒ nada de lo que hay está medido\n');

  const cfg = await prisma.configCostos.findUnique({ where: { id: 'singleton' }, select: { estampadoValorHora: true } });
  const $min = (cfg?.estampadoValorHora ?? 0) / 60;
  const productos = await prisma.productoEstampado.findMany({ orderBy: [{ marca: 'asc' }, { nombre: 'asc' }] });

  let tocados = 0;
  for (const p of productos) {
    const lineas = p.estampas as unknown as Linea[];
    if (!lineas.length) continue;
    // Los que ya tienen minutos conservan los suyos: son de otra prenda y otro tamaño de
    // estampa, y pisarlos con 12 sería inventar sobre un dato que alguien puso a propósito.
    const nuevas = lineas.map((l) => ({
      ...l,
      minutosEstampado: l.minutosEstampado || MIN_POR_PLANCHADO,
      minEstimado: true,
    }));
    const cambia = JSON.stringify(nuevas) !== JSON.stringify(lineas);
    if (!cambia) continue;
    tocados++;
    const min = nuevas.reduce((s, l) => s + (l.minutosEstampado ?? 0), 0);
    console.log(`${(p.marca ?? '—').padEnd(8)} ${p.nombre.padEnd(22)} ${nuevas.length} planchado(s) · ${min} min · MO $${Math.round(min * $min).toLocaleString('es-AR')}`);
    if (APLICAR) await prisma.productoEstampado.update({ where: { id: p.id }, data: { estampas: nuevas as unknown as object } });
  }
  console.log(`\nproductos tocados: ${tocados} de ${productos.length}`);
  console.log(APLICAR ? '✅ aplicado' : '(dry-run: nada escrito. Correr con --aplicar)');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
