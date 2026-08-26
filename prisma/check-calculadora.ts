// ORÁCULO de una corrida de muestra. Sólo LEE, y a propósito **no importa**
// `lib/calculadora/corrida.ts`: va con SQL crudo. Si compartiera código con lo
// que verifica, un error viviría en los dos lados y esto no mediría nada.
//
//   npx tsx prisma/check-calculadora.ts <corridaId>
import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const n = (x: number) => x.toLocaleString('es-AR', { maximumFractionDigits: 2 });

async function main() {
  const id = process.argv[2];
  if (!id) { console.error('Falta el id de la corrida'); process.exit(1); }
  await client.connect();

  const { rows: [c] } = await client.query(
    `SELECT nombre, talle, costurera, modo, estado, "unidadesObjetivo" FROM corridas_muestra WHERE id = $1`, [id]);
  if (!c) { console.error('No existe esa corrida'); process.exit(1); }
  console.log(`${c.nombre} · ${c.talle} · ${c.costurera} · ${c.modo} · ${c.estado}\n`);

  // 1) Trabajo y parada por prenda, y la identidad que sostiene el modelo.
  const { rows: porUnidad } = await client.query(`
    SELECT unidad,
           sum(CASE WHEN tipo = 'paso'   THEN "minutosNetos" ELSE 0 END)::float8 trabajo,
           sum(CASE WHEN tipo = 'parada' THEN "minutosNetos" ELSE 0 END)::float8 parada,
           sum("minutosNetos")::float8 total
      FROM corrida_mediciones
     WHERE "corridaId" = $1 AND "horaFin" IS NOT NULL
     GROUP BY unidad ORDER BY unidad`, [id]);

  console.log('POR PRENDA');
  for (const u of porUnidad) {
    const ok = Math.abs(u.trabajo + u.parada - u.total) < 0.001;
    console.log(`  p${u.unidad}: trabajo ${n(u.trabajo)} + parada ${n(u.parada)} = ${n(u.total)}  ${ok ? '✓' : '✗ NO CIERRA'}`);
  }
  const trabajos = porUnidad.map((u) => u.trabajo);
  const prom = trabajos.reduce((s, x) => s + x, 0) / (trabajos.length || 1);
  console.log(`  promedio de trabajo: ${n(prom)} min/prenda · última ${n(trabajos.at(-1) ?? 0)} · mejor ${n(Math.min(...trabajos))}`);
  console.log(`  ⚠️ las paradas NO entran al estándar: ya están adentro del costoMinuto del taller\n`);

  // 2) Desvío de máquina: real contra la responsable del paso.
  const { rows: desvios } = await client.query(`
    SELECT p.nombre, p.maquina definida, coalesce(m.maquina, p.maquina) real,
           sum(m."minutosNetos")::float8 min,
           count(DISTINCT m.unidad)::int unidades
      FROM corrida_mediciones m
      JOIN corrida_pasos p ON p.id = m."pasoId"
     WHERE m."corridaId" = $1 AND m.tipo = 'paso' AND m."horaFin" IS NOT NULL
     GROUP BY p.nombre, p.maquina, coalesce(m.maquina, p.maquina)
     ORDER BY p.nombre`, [id]);

  const { rows: [{ u: unidadesMedidas }] } = await client.query(
    `SELECT count(DISTINCT unidad)::int u FROM corrida_mediciones
      WHERE "corridaId" = $1 AND tipo = 'paso' AND "horaFin" IS NOT NULL`, [id]);

  console.log('DESVÍOS DE MÁQUINA');
  const pasos = [...new Set(desvios.map((d) => d.nombre))];
  for (const nombre of pasos) {
    const filas = desvios.filter((d) => d.nombre === nombre);
    const total = filas.reduce((s, f) => s + f.min, 0);
    const fuera = filas.filter((f) => f.real !== f.definida);
    if (fuera.length === 0) continue;
    const unidadesConDesvio = Math.max(...fuera.map((f) => f.unidades));
    console.log(`  ${nombre} — definido ${filas[0].definida}`);
    for (const f of filas) console.log(`     ${f.real}: ${n(f.min)} min (${Math.round((f.min / total) * 100)}%)`);
    console.log(`     en ${unidadesConDesvio} de ${unidadesMedidas} prendas ${unidadesConDesvio === unidadesMedidas ? '→ SISTEMÁTICO: ese paso son DOS pasos' : '(anécdota)'}`);
  }
  if (!pasos.some((nm) => desvios.some((d) => d.nombre === nm && d.real !== d.definida))) console.log('  ninguno');

  // 3) Ribete cargado.
  const { rows: ribetes } = await client.query(
    `SELECT nombre, "anchoCm", "largoCm" FROM corrida_ribetes WHERE "corridaId" = $1 ORDER BY orden`, [id]);
  console.log(`\nRIBETE (talle ${c.talle})`);
  for (const r of ribetes) console.log(`  ${r.nombre}: ${n(r.anchoCm)} × ${n(r.largoCm)} cm`);
  if (ribetes.length === 0) console.log('  sin cargar');

  // 4) Tramos abiertos: uno colgado falsearía el total para siempre.
  const { rows: [{ n: abiertos }] } = await client.query(
    `SELECT count(*)::int n FROM corrida_mediciones WHERE "corridaId" = $1 AND "horaFin" IS NULL`, [id]);
  console.log(`\nTRAMOS ABIERTOS: ${abiertos} ${abiertos === 0 ? '✓' : '⚠️ hay uno corriendo'}`);

  await client.end();
}
main();
