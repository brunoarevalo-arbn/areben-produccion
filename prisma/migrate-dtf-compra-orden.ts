// Puntos 3 y 4 del plan del precio del DTF:
//  3. la compra puede entrar a cuentas por pagar como Gasto (`gastoId`, ya existía).
//  4. la compra se vincula a la ORDEN para la que se hizo (`ordenId`, nueva) — eso es lo
//     que deja comparar lo que la TIRA dijo que hacía falta contra lo que se compró.
// Y se vincula la única compra que hay a la orden de lanzamiento del 20-ago, que es
// para la que se compró.
//
//   npx tsx prisma/migrate-dtf-compra-orden.ts            → sólo informa
//   npx tsx prisma/migrate-dtf-compra-orden.ts --aplicar  → escribe
import 'dotenv/config';
import pg from 'pg';
const APLICAR = process.argv.includes('--aplicar');
const c = new pg.Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });

async function main() {
  await c.connect();
  const col = (await c.query(`SELECT 1 FROM information_schema.columns WHERE table_name='compras_dtf' AND column_name='ordenId'`)).rowCount;
  console.log(col ? 'compras_dtf.ordenId: ya existe' : 'compras_dtf.ordenId: FALTA');
  if (!col && APLICAR) {
    await c.query(`ALTER TABLE compras_dtf ADD COLUMN "ordenId" TEXT REFERENCES ordenes_estampa(id) ON DELETE SET NULL`);
    await c.query(`CREATE INDEX compras_dtf_orden_idx ON compras_dtf("ordenId")`);
  }

  const { rows: [orden] } = await c.query(
    `SELECT id, "creadoAt"::date f FROM ordenes_estampa WHERE origen='lanzamiento' ORDER BY "creadoAt" DESC LIMIT 1`);
  const { rows: [compra] } = await c.query(`SELECT id, fecha::date f, metros::float m FROM compras_dtf ORDER BY fecha DESC LIMIT 1`);
  if (orden && compra) {
    console.log(`vincular compra del ${compra.f.toISOString().slice(0, 10)} (${compra.m} m) → orden de lanzamiento del ${orden.f.toISOString().slice(0, 10)}`);
    if (APLICAR) await c.query(`UPDATE compras_dtf SET "ordenId" = $1 WHERE id = $2 AND "ordenId" IS NULL`, [orden.id, compra.id]);
  } else console.log('no hay orden de lanzamiento o compra para vincular');

  console.log(APLICAR ? '\n✅ aplicado' : '\n(dry-run: nada escrito. Correr con --aplicar)');
  await c.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
