// Migración de datos: `CorridaRibete.largoCm` (un solo largo por ribete) pasa a
// ser un CORTE del tubo en `corrida_cortes_tubo`, que es la secuencia real.
// Idempotente: no duplica si el corte ya existe.
//
//   npx tsx prisma/migrate-cortes-tubo-ago26.ts            (sólo mira)
//   npx tsx prisma/migrate-cortes-tubo-ago26.ts --aplicar
import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const aplicar = process.argv.includes('--aplicar');

async function main() {
  await client.connect();

  const tiene = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'corrida_ribetes' AND column_name = 'largoCm'`);
  if (tiene.rowCount === 0) {
    console.log('La columna largoCm ya no existe: nada que migrar.');
    await client.end(); return;
  }

  const { rows } = await client.query(`
    SELECT r.id, r."corridaId", r.nombre, r.orden, r."largoCm"
      FROM corrida_ribetes r
     WHERE r."largoCm" > 0
       AND NOT EXISTS (SELECT 1 FROM corrida_cortes_tubo c WHERE c."ribeteId" = r.id)
     ORDER BY r."corridaId", r.orden`);

  console.log(`${rows.length} ribete(s) con largo para pasar a cortes:`);
  for (const r of rows) console.log(`  ${r.nombre}: ${r.largoCm} cm → corte de la prenda 1`);
  if (!aplicar) { console.log('\n(sólo mirando — pasá --aplicar para escribir)'); await client.end(); return; }

  for (const r of rows) {
    await client.query(
      `INSERT INTO corrida_cortes_tubo (id, "corridaId", "ribeteId", unidad, orden, "largoCm", "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, 1, $3, $4, now())`,
      [r.corridaId, r.id, r.orden, r.largoCm]);
  }
  console.log(`\n✓ ${rows.length} corte(s) creados.`);
  await client.end();
}
main();
