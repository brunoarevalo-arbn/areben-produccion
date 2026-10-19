// Aplica prisma/sql/2026-10-19-avios-al-costo.sql (sólo agrega 2 columnas, idempotente) y relee.
//   npx tsx --env-file=.env prisma/aplicar-sql-avios-al-costo.ts
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
async function main() {
  console.log('base:', (process.env.DIRECT_URL || process.env.DATABASE_URL || '').split('@')[1]?.split('/')[0]);
  const stmts = readFileSync('prisma/sql/2026-10-19-avios-al-costo.sql', 'utf8').split('\n').filter((l) => /^ALTER/.test(l));
  await p.$transaction(async (tx) => { for (const s of stmts) await tx.$executeRawUnsafe(s); });
  console.log(await p.$queryRawUnsafe(`SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE (table_name='etiqueta_catalogo' AND column_name='parte') OR (table_name='lotes_corte' AND column_name='costoAviosUnit')`));
}
main().finally(() => p.$disconnect());
