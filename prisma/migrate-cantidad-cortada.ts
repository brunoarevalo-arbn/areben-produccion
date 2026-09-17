// Llena `OrdenProduccion.cantidadCortada` con lo que realmente se cortó, para que
// `cantidad` pueda volver a significar UNA sola cosa: lo planificado.
//
// 🔴 Por qué hacía falta: `cantidad` era un campo único que se pisaba cuatro veces —al
// crear (planificado), en la carga del cortador, en la carga del taller y en la ficha de
// tela (cortado), y otra vez al terminar costura (producido)—. Como el costo unitario es
// `costoTotal / cantidad`, el denominador cambiaba solo: entrar 20 de un corte de 100
// dejaba la tela de las 100 dividida por 20. Hasta hoy no mordió porque el ingreso
// parcial no existe (el modal de terminar viene prellenado del corte y se acepta tal
// cual), pero la temporada de bikinis entra de a partes a propósito.
//
// De dónde sale el número, en orden:
//   1. `CortePorTalle` — lo escribe la ficha de tela (`registrarCorteOrden`)
//   2. `fichaCorteData.talles` — lo escriben las dos cargas de corte, que no tocan
//      `CortePorTalle`
// Si no hay ninguno de los dos, la OP no tiene corte cargado y queda en NULL.
//
// Medido antes de correr (17-sep-2026): de 67 OP, 25 sin corte cargado, 41 con
// `cantidad` ya IGUAL a lo cortado y 1 sola que difiere (ZAT-BUZ-CH-001: cortó 20,
// ingresó 14, y su costoTotal es $0) ⇒ este backfill no mueve ningún costo.
//
//   npx tsx prisma/migrate-cantidad-cortada.ts            → sólo informa
//   npx tsx prisma/migrate-cantidad-cortada.ts --aplicar  → escribe
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
const APLICAR = process.argv.includes('--aplicar');

function tallesDeFicha(fd: unknown): number {
  if (!fd || typeof fd !== 'object') return 0;
  const talles = (fd as Record<string, unknown>).talles;
  if (!talles || typeof talles !== 'object') return 0;
  return Object.values(talles as Record<string, unknown>)
    .reduce<number>((s, v) => s + (parseInt(String(v), 10) || 0), 0);
}

async function main() {
  const ordenes = await prisma.ordenProduccion.findMany({
    include: { cortesPorTalle: true },
    orderBy: { createdAt: 'asc' },
  });

  const aEscribir: { id: string; sku: string | null; estado: string; cantidad: number; cortada: number; fuente: string }[] = [];
  let sinCorte = 0;
  let yaTenia = 0;

  for (const o of ordenes) {
    if (o.cantidadCortada != null) { yaTenia++; continue; }
    const porTalle = o.cortesPorTalle.reduce((s, t) => s + t.cantidad, 0);
    const porFicha = tallesDeFicha(o.fichaCorteData);
    const cortada = porTalle || porFicha;
    if (!cortada) { sinCorte++; continue; }
    aEscribir.push({
      id: o.id, sku: o.sku, estado: o.estado, cantidad: o.cantidad, cortada,
      fuente: porTalle ? 'CortePorTalle' : 'fichaCorteData',
    });
  }

  console.log(`OP totales: ${ordenes.length} · ya tenían cantidadCortada: ${yaTenia} · sin corte cargado: ${sinCorte} · a escribir: ${aEscribir.length}`);
  const distintas = aEscribir.filter((f) => f.cantidad !== f.cortada);
  console.log(`De las que se escriben, ${aEscribir.length - distintas.length} tienen cantidad == cortada y ${distintas.length} difieren:`);
  for (const f of distintas) {
    console.log(`   ${String(f.sku).padEnd(20)} ${f.estado.padEnd(24)} cantidad=${f.cantidad}  cortada=${f.cortada}  [${f.fuente}]`);
  }

  if (!APLICAR) {
    console.log('\nDRY-RUN. Volvé a correrlo con --aplicar para escribir.');
    return;
  }

  let n = 0;
  for (const f of aEscribir) {
    await prisma.ordenProduccion.update({ where: { id: f.id }, data: { cantidadCortada: f.cortada } });
    n++;
  }
  console.log(`\nEscritas ${n} órdenes.`);

  // Releer y confirmar: el oráculo no es el contador del loop.
  const verif = await prisma.ordenProduccion.findMany({
    where: { cantidadCortada: null },
    include: { cortesPorTalle: true },
  });
  const faltantes = verif.filter((o) => o.cortesPorTalle.length > 0 || tallesDeFicha(o.fichaCorteData) > 0);
  console.log(`Releído: quedan ${faltantes.length} OP con corte cargado y cantidadCortada en NULL (debería ser 0).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
