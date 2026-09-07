// El precio del DTF deja de tipearse y sale de la COMPRA. Tres escrituras:
//
//  1. tabla `compras_dtf` — la compra (metros, $/metro, flete, factura).
//  2. `ordenes_estampa.precioMetroDtf` — el snapshot del precio al crear la orden.
//  3. Se carga la ÚNICA compra que se sabe: la de la orden de lanzamiento de Stunned,
//     43 m a $9.500 (dicha por Bruno el 7-sep-2026). Sin flete: no se sabe si hubo, y
//     ⛔ inventarlo sería peor que dejarlo en 0 — un 0 acá se corrige editando la compra.
//     El snapshot se backfillea SÓLO en la orden del 20-ago, que es la de esa compra. Las
//     de jun/jul quedan en 0 —que significa "cae al precio vigente"— porque de ésas ⛔ no
//     se sabe el precio: un snapshot inventado es PEOR que no tenerlo, parece medido.
//
//   npx tsx prisma/migrate-dtf-compras.ts            → sólo informa
//   npx tsx prisma/migrate-dtf-compras.ts --aplicar  → escribe
import 'dotenv/config';
import pg from 'pg';
import { resolverPrecioDtf } from '../lib/costos/dtfPrecio';

const APLICAR = process.argv.includes('--aplicar');
const c = new pg.Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });

// La compra real de la orden de lanzamiento. La fecha es la de la orden.
const COMPRA = { fecha: '2026-08-20', metros: 43, precioMetro: 9500, flete: 0, notas: 'Orden de estampa de lanzamiento Stunned (13 diseños, 149 prendas)' };

async function main() {
  await c.connect();

  const tabla = (await c.query(`SELECT 1 FROM information_schema.tables WHERE table_name='compras_dtf'`)).rowCount;
  console.log(tabla ? 'tabla compras_dtf: ya existe' : 'tabla compras_dtf: FALTA');
  if (!tabla && APLICAR) {
    await c.query(`
      CREATE TABLE compras_dtf (
        id             TEXT PRIMARY KEY,
        fecha          TIMESTAMP(3) NOT NULL,
        metros         DECIMAL(65,30) NOT NULL,
        "precioMetro"  DECIMAL(65,30) NOT NULL,
        flete          DECIMAL(65,30) NOT NULL DEFAULT 0,
        "proveedorId"  TEXT REFERENCES proveedores(id),
        "numeroFactura" TEXT,
        "gastoId"      TEXT,
        notas          TEXT,
        "creadoPor"    TEXT NOT NULL,
        "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    await c.query(`CREATE INDEX compras_dtf_fecha_idx ON compras_dtf(fecha)`);
  }

  const col = (await c.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name='ordenes_estampa' AND column_name='precioMetroDtf'`)).rowCount;
  console.log(col ? 'columna ordenes_estampa.precioMetroDtf: ya existe' : 'columna ordenes_estampa.precioMetroDtf: FALTA');
  if (!col && APLICAR) {
    await c.query(`ALTER TABLE ordenes_estampa ADD COLUMN "precioMetroDtf" DECIMAL(65,30) NOT NULL DEFAULT 0`);
  }

  if (!APLICAR) { console.log('\n(dry-run: nada escrito. Correr con --aplicar)'); await c.end(); return; }

  const { rows: yaHay } = await c.query(`SELECT id FROM compras_dtf WHERE fecha = $1 AND metros = $2`, [COMPRA.fecha, COMPRA.metros]);
  if (yaHay.length) console.log(`compra del ${COMPRA.fecha}: ya estaba`);
  else {
    const id = 'cdtf' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    await c.query(
      `INSERT INTO compras_dtf (id, fecha, metros, "precioMetro", flete, notas, "creadoPor") VALUES ($1,$2,$3,$4,$5,$6,'admin')`,
      [id, COMPRA.fecha, COMPRA.metros, COMPRA.precioMetro, COMPRA.flete, COMPRA.notas]);
    console.log(`compra del ${COMPRA.fecha}: creada — ${COMPRA.metros} m a $${COMPRA.precioMetro.toLocaleString('es-AR')}`);
  }

  const { rows: compras } = await c.query(
    `SELECT id, fecha, metros::float metros, "precioMetro"::float "precioMetro", flete::float flete FROM compras_dtf`);
  const p = resolverPrecioDtf(compras, null);
  console.log(`\nprecio resuelto: $${p.precioMetro?.toLocaleString('es-AR')}/m (${p.fuente}, ${p.antiguedadDias} días)`);

  // Sólo la orden de ESTA compra. Las anteriores quedan en 0 = "cae al precio vigente".
  const r = await c.query(
    `UPDATE ordenes_estampa SET "precioMetroDtf" = $1 WHERE "precioMetroDtf" = 0 AND "creadoAt" >= $2`,
    [p.precioMetro, COMPRA.fecha]);
  console.log(`órdenes con el snapshot backfilleado: ${r.rowCount} (las anteriores a ${COMPRA.fecha} quedan en 0: no se sabe su precio)`);

  console.log('\n✅ aplicado');
  await c.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
