// TAYRA estampada Lote 1: el remallado se cosió UNIFICADO y se cargó todo a LUNCEL (Bruno, 19-oct:
// flujo más rápido, misma forrería, se toca menos la tablet). Son las 75 del Lote 1 (15 por color)
// ⇒ se reparte EN PARTES IGUALES entre los 5 colores. Cada registro se parte en 5 tramos seguidos
// de igual duración (uno por color), así no se pisan horarios y Σ minutos queda igual. Todos van
// a lote 1: sin lote, `loteCorte.ts` los repartiría también sobre el Lote 2.
//
//   npx tsx --env-file=.env prisma/repartir-remallado-tayra-lote1.ts            (ensayo)
//   npx tsx --env-file=.env prisma/repartir-remallado-tayra-lote1.ts --aplicar
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
const aplicar = process.argv.includes('--aplicar');
const SKUS = ['ZAT-BIK-LUNCEL-001', 'ZAT-BIK-LUNCH-001', 'ZAT-BIK-RAYVIO-001', 'ZAT-BIK-CUADRJ-001', 'ZAT-BIK-RAYCEL-001'];
const NOTA = 'Repartido el 19-oct (Bruno): remallado de la TAYRA Lote 1 cosido unificado, partes iguales entre los 5 colores';
const IDS_ESPERADOS = 4;
const TOTAL_ESPERADO = 386.84;

const seg = (h: string) => h.split(':').map(Number).reduce((a, n) => a * 60 + n, 0);
const hora = (s: number) => [s / 3600, (s % 3600) / 60, s % 60].map((n) => String(Math.floor(n)).padStart(2, '0')).join(':');
const r2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const rem = await p.tiemposProduccion.findMany({
    where: { sku: { in: SKUS }, maquina: 'Remalladora', estado: 'guardado' },
    orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
  });
  if (rem.some((r) => r.sku !== SKUS[0])) throw new Error('ya hay remallado en otro color: ¿ya se repartió?');
  if (rem.length !== IDS_ESPERADOS) throw new Error(`esperaba ${IDS_ESPERADOS} registros, hay ${rem.length}`);
  const total = r2(rem.reduce((s, r) => s + r.minutosNetos, 0));
  if (Math.abs(total - TOTAL_ESPERADO) > 0.05) throw new Error(`el total cambió: ${total}`);
  if (rem.some((r) => r.parte !== 'Corpiño' && r.parte !== 'Bombacha')) throw new Error('hay remallado sin pieza');

  const ops = [];
  for (const r of rem) {
    const ini = seg(r.horaInicio!), fin = seg(r.horaFin!);
    const paso = (fin - ini) / SKUS.length;
    const min = r2(r.minutosNetos / SKUS.length);
    console.log(`${r.fecha} ${r.horaInicio}-${r.horaFin} ${r.parte} ${r.minutosNetos} min (lote ${r.lote ?? '—'}) ⇒ 5 × ${min}`);
    SKUS.forEach((sku, i) => {
      const hi = hora(Math.round(ini + paso * i)), hf = i === SKUS.length - 1 ? r.horaFin! : hora(Math.round(ini + paso * (i + 1)));
      // el último tramo absorbe el redondeo para que la suma sea exacta
      const m = i === SKUS.length - 1 ? r2(r.minutosNetos - min * (SKUS.length - 1)) : min;
      console.log(`   ${sku} ${hi}-${hf} ${m}`);
      if (i === 0) ops.push(p.tiemposProduccion.update({ where: { id: r.id, sku: SKUS[0] }, data: { horaFin: hf, minutosNetos: m, lote: 1, detalle: NOTA } }));
      else ops.push(p.tiemposProduccion.create({ data: {
        usuario: r.usuario, actividad: r.actividad, fecha: r.fecha, marca: r.marca, maquina: r.maquina, sku, lote: 1,
        parte: r.parte, cantidad: 0, defectos: 0, horaInicio: hi, horaFin: hf, minutosNetos: m, estado: 'guardado', detalle: NOTA,
      } }));
    });
  }
  if (!aplicar) { console.log('\nENSAYO: nada escrito. Repetir con --aplicar.'); return; }

  await p.$transaction(ops);
  const t = await p.tiemposProduccion.groupBy({ by: ['sku', 'parte', 'lote'], where: { sku: { in: SKUS }, maquina: 'Remalladora', estado: 'guardado' }, _sum: { minutosNetos: true } });
  console.log('\nAPLICADO. Releído:');
  for (const x of t.sort((a, b) => (a.sku! + a.parte).localeCompare(b.sku! + b.parte))) console.log(`  ${x.sku} L${x.lote} ${x.parte} ${r2(x._sum.minutosNetos ?? 0)}`);
  console.log('  total', r2(t.reduce((s, x) => s + (x._sum.minutosNetos ?? 0), 0)));
}
main().finally(() => p.$disconnect());
