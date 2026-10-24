// Deja configurado el pago de horas de Marisol (24-oct): tarifa $6.000/h desde el 26-oct, jornada de
// 9 h con tolerancia de 29 min, fracciones de 30 min, presencia (el almuerzo NO se descuenta),
// quincenal desde el lunes 26-oct. Upsert idempotente y relee.
//   npx tsx --env-file=.env prisma/cargar-pago-horas-marisol.ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
async function main() {
  const u = await p.usuario.findFirst({ where: { nombre: 'Marisol', rol: 'costurera', activo: true } });
  if (!u) throw new Error('no encuentro a Marisol');
  const usuarioId = u.id;
  const data = { jornadaMin: 540, toleranciaMin: 29, fraccionMin: 30, redondeo: 'CERCANO', descuentaPausas: false, recargoExtraPct: 0, periodo: 'QUINCENAL', anclaPeriodo: '2026-10-26', diasSemana: [1, 2, 3, 4, 5], activo: true };
  await p.configPagoHoras.upsert({ where: { usuarioId }, create: { usuarioId, ...data }, update: data });
  await p.tarifaHora.upsert({ where: { usuarioId_desde: { usuarioId, desde: '2026-10-26' } }, create: { usuarioId, desde: '2026-10-26', montoHora: 6000 }, update: { montoHora: 6000 } });
  console.log(await p.configPagoHoras.findUnique({ where: { usuarioId } }));
  console.log(await p.tarifaHora.findMany({ where: { usuarioId } }));
}
main().finally(() => p.$disconnect());
