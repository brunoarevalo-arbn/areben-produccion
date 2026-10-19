// El cortacollareta del 19-oct 08:35 (20,8 min, sin SKU) era de la TAYRA RAYVIO (Bruno) ⇒ SKU + lote 1,
// como el resto de RAYVIO de ese día. Guard: sólo si sigue sin SKU.
//   npx tsx --env-file=.env prisma/cortacollareta-rayvio-19oct.ts [--aplicar]
import { prisma } from '../lib/prisma';
async function main() {
  const regs = await prisma.tiemposProduccion.findMany({
    where: { fecha: '2026-10-19', horaInicio: { startsWith: '08:35' }, sku: null, maquina: 'Cortacollareta' },
  });
  for (const r of regs) console.log(r.id, r.horaInicio, r.horaFin, r.parte, Number(r.minutosNetos), r.lote);
  if (regs.length !== 1) throw new Error(`Se esperaba 1 registro, hay ${regs.length}`);
  if (process.argv.includes('--aplicar')) {
    const n = await prisma.tiemposProduccion.updateMany({ where: { id: regs[0].id, sku: null }, data: { sku: 'ZAT-BIK-RAYVIO-001', lote: 1 } });
    const r = await prisma.tiemposProduccion.findUniqueOrThrow({ where: { id: regs[0].id } });
    console.log('actualizados', n.count, '· releído:', r.sku, 'lote', r.lote, r.parte, Number(r.minutosNetos));
  }
}
main().finally(() => prisma.$disconnect());
