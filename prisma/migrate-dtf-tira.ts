// El costo DTF pasa de ÁREA a TIRA (ver lib/costos/estampaCosto.ts). Dos escrituras:
//
//  1. `config_costos.dtfSeparacionCm` — columna nueva: el margen de corte entre estampas.
//  2. La merma deja de ser el desperdicio de encastre y pasa a ser sólo el RECHAZO.
//     El encastre ya está adentro de la tira, así que dejar el 15% viejo lo contaría dos
//     veces. Nadie midió el rechazo todavía ⇒ va en 0 y queda dicho en PENDIENTES.md.
//     (Las fallas de PRENDA no se pierden: ya viven en `margenFallas`, aparte.)
//
//   npx tsx prisma/migrate-dtf-tira.ts            → sólo informa
//   npx tsx prisma/migrate-dtf-tira.ts --aplicar  → escribe
import 'dotenv/config';
import pg from 'pg';

const APLICAR = process.argv.includes('--aplicar');
const SEP_DEFAULT = 0.5;
const c = new pg.Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });

async function main() {
  await c.connect();

  const { rows: [col] } = await c.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name='config_costos' AND column_name='dtfSeparacionCm'`);
  console.log(col ? 'columna dtfSeparacionCm: ya existe' : `columna dtfSeparacionCm: FALTA (se crea con default ${SEP_DEFAULT})`);
  if (!col && APLICAR) {
    await c.query(`ALTER TABLE config_costos ADD COLUMN "dtfSeparacionCm" DOUBLE PRECISION NOT NULL DEFAULT ${SEP_DEFAULT}`);
  }

  const { rows: [n] } = await c.query(
    `SELECT count(*)::int total,
            count(*) FILTER (WHERE "mermaPercent" <> 0 OR "merma2Percent" <> 0)::int conMerma
     FROM estampas`);
  console.log(`estampas: ${n.total} · con merma cargada: ${n.conmerma ?? n.conMerma}`);
  const { rows: [cfg] } = await c.query(`SELECT "dtfMermaDefault"::float m FROM config_costos`);
  console.log(`dtfMermaDefault: ${cfg.m} → 0`);

  if (APLICAR) {
    await c.query(`UPDATE estampas SET "mermaPercent" = 0, "merma2Percent" = 0`);
    await c.query(`UPDATE config_costos SET "dtfMermaDefault" = 0`);
  }
  console.log(APLICAR ? '\n✅ aplicado' : '\n(dry-run: nada escrito. Correr con --aplicar)');
  await c.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
