// Aplica prisma/sql/2026-10-24-pago-horas.sql (sólo crea 4 tablas nuevas, idempotente) y relee.
//   npx tsx --env-file=.env prisma/aplicar-sql-pago-horas.ts
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
async function main() {
  console.log('base:', (process.env.DIRECT_URL || process.env.DATABASE_URL || '').split('@')[1]?.split('/')[0]);
  const stmts = readFileSync('prisma/sql/2026-10-24-pago-horas.sql', 'utf8').split(';').map((s) => s.trim()).filter((s) => /^CREATE/.test(s));
  await p.$transaction(async (tx) => { for (const s of stmts) await tx.$executeRawUnsafe(s); });
  console.log(await p.$queryRawUnsafe(`SELECT table_name FROM information_schema.tables
    WHERE table_name IN ('config_pago_horas','tarifas_hora','ajustes_horas_dia','liquidaciones_horas')`));
}
main().finally(() => p.$disconnect());
