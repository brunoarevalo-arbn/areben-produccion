// ORÁCULO de la cuenta corriente de cortadores. Sólo LEE, y a propósito **no importa**
// `lib/produccion/cuenta-cortador.ts`: va con SQL crudo. Si compartiera código con lo que
// verifica, un error viviría en los dos lados y esto no mediría nada.
//
//   npx tsx prisma/check-cuenta-cortadores.ts
import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const $ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

// El mismo predicado de "corte cobrable", escrito a mano en SQL: es la contra-prueba del
// que vive en el núcleo.
const COBRABLE = `o."costoCorte" > 0 AND (o."fichaCorteCargada" = true OR o."corteEstado" = 'validado')`;

async function main() {
  await client.connect();

  const deuda = await client.query(`
    SELECT c.id, c.nombre, count(*)::int n, sum(o."costoCorte")::float8 s
    FROM ordenes_produccion o JOIN cortadores c ON c.id = o."cortadorId"
    WHERE ${COBRABLE} GROUP BY c.id, c.nombre`);
  const muestras = await client.query(`
    SELECT c.id, count(*)::int n, sum(m.valor)::float8 s
    FROM cortes_muestra m JOIN cortadores c ON c.id = m."cortadorId"
    WHERE m.estado = 'validado' GROUP BY c.id`);
  const pagos = await client.query(`
    SELECT c.id, count(*)::int n, sum(p."montoTotal")::float8 s
    FROM pagos_cortes p JOIN cortadores c ON c.id = p."cortadorId" GROUP BY c.id`);

  const ids = new Set([...deuda.rows, ...muestras.rows, ...pagos.rows].map((r) => r.id));
  console.log('cortador          cortes         muestras        pagos          saldo');
  for (const id of ids) {
    const d = deuda.rows.find((r) => r.id === id);
    const m = muestras.rows.find((r) => r.id === id);
    const p = pagos.rows.find((r) => r.id === id);
    const saldo = (d?.s ?? 0) + (m?.s ?? 0) - (p?.s ?? 0);
    console.log(
      `${(d?.nombre ?? id).padEnd(16)}  ${$(d?.s ?? 0).padStart(9)} (${d?.n ?? 0})  ${$(m?.s ?? 0).padStart(8)} (${m?.n ?? 0})  ` +
      `${$(p?.s ?? 0).padStart(9)} (${p?.n ?? 0})  ${(saldo < 0 ? `${$(-saldo)} a favor` : $(saldo)).padStart(12)}`,
    );
  }

  // Plata que no está en ninguna cuenta: si esto no es cero, el saldo de arriba miente por
  // omisión y no avisa.
  const huerfanos = await client.query(`SELECT id, fecha::date, beneficiario, "montoTotal"::float8 m FROM pagos_cortes WHERE "cortadorId" IS NULL ORDER BY fecha`);
  const sinDuenio = await client.query(`SELECT count(*)::int n, coalesce(sum(o."costoCorte"),0)::float8 s FROM ordenes_produccion o WHERE ${COBRABLE} AND o."cortadorId" IS NULL`);
  console.log(`\npagos sin cortador: ${huerfanos.rowCount} ${huerfanos.rows.length ? `(${$(huerfanos.rows.reduce((s, r) => s + r.m, 0))})` : ''}`);
  for (const h of huerfanos.rows) console.log(`   ${h.fecha.toISOString().slice(0, 10)} · ${h.beneficiario} · ${$(h.m)} · ${h.id}`);
  console.log(`cortes cobrables sin cortador: ${sinDuenio.rows[0].n} (${$(sinDuenio.rows[0].s)})`);
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => client.end());
