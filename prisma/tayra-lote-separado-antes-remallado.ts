// TAYRA estampada: el Lote 1 / Lote 2 se separó ANTES del remallado (Bruno, 19-oct), no "después de
// Remallado" como se cargó el 16-oct. Lote 2 pasa a "Todo cortado" y queda activo desde que se
// separó (separadoAt); el Lote 1 también, que en 4 de los 5 colores seguía programado.
//
//   npx tsx --env-file=.env prisma/tayra-lote-separado-antes-remallado.ts            (ensayo)
//   npx tsx --env-file=.env prisma/tayra-lote-separado-antes-remallado.ts --aplicar
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
const aplicar = process.argv.includes('--aplicar');
const SKUS = ['ZAT-BIK-LUNCEL-001', 'ZAT-BIK-LUNCH-001', 'ZAT-BIK-RAYVIO-001', 'ZAT-BIK-CUADRJ-001', 'ZAT-BIK-RAYCEL-001'];

async function main() {
  const lotes = await p.lotePlanificado.findMany({ where: { orden: { sku: { in: SKUS } } }, include: { orden: { select: { sku: true } } } });
  if (lotes.length !== 10) throw new Error(`esperaba 10 lotes, hay ${lotes.length}`);
  const ops = [];
  for (const l of lotes.sort((a, b) => a.orden.sku!.localeCompare(b.orden.sku!) || a.numero - b.numero)) {
    const despuesDe = l.numero === 2 ? 'Todo cortado' : l.despuesDe;
    if (l.numero === 2 && l.despuesDe !== 'Remallado') throw new Error(`${l.id} ya no dice Remallado`);
    console.log(`${l.orden.sku} L${l.numero}: ${l.despuesDe} → ${despuesDe} · activado ${l.activadoAt?.toISOString() ?? 'PROGRAMADO'} → ${l.separadoAt.toISOString()}`);
    ops.push(p.lotePlanificado.update({ where: { id: l.id }, data: { despuesDe, activadoAt: l.separadoAt } }));
  }
  if (!aplicar) { console.log('\nENSAYO: nada escrito. Repetir con --aplicar.'); return; }
  await p.$transaction(ops);
  const r = await p.lotePlanificado.findMany({ where: { orden: { sku: { in: SKUS } } }, include: { orden: { select: { sku: true } } } });
  console.log('\nAPLICADO. Releído:');
  for (const l of r.sort((a, b) => a.orden.sku!.localeCompare(b.orden.sku!) || a.numero - b.numero)) console.log(`  ${l.orden.sku} L${l.numero} ${l.despuesDe} ${l.activadoAt?.toISOString() ?? 'PROGRAMADO'} enTaller=${l.enTaller}`);
}
main().finally(() => p.$disconnect());
