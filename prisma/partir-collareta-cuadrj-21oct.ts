// TAYRA-4 vichy roja (CUADRJ), collareta del 21-oct 10:19-10:50, cargada entera al Lote 1. La tira
// sale continua del tubo y se encadena (receta de tira del escandallo): cada vuelta fue la tira
// superior de una del Lote 1 (≈115 cm, casi todo bretel) y los ≈20 cm que se iban a tirar se usaron
// en un escote del Lote 2 ⇒ 19 escotes del Lote 2 en el registro. Bruno (21-oct): 6 min al Lote 2
// (por cm sería 4,5; el bretel, tira sola, va más rápido por cm que un escote sobre la pieza).
// Se parte en dos tramos seguidos; Σ minutos queda igual.
//
//   npx tsx --env-file=.env prisma/partir-collareta-cuadrj-21oct.ts            (ensayo)
//   npx tsx --env-file=.env prisma/partir-collareta-cuadrj-21oct.ts --aplicar
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
const aplicar = process.argv.includes('--aplicar');
const ID = 'cmvi65v1q000007jpmnrg8vez';
const MIN_LOTE2 = 6;
const NOTA = 'Partido el 21-oct (Bruno): tira superior del Lote 1 encadenada con 19 escotes del Lote 2 (los ≈20 cm de fin de vuelta) ⇒ 6 min al Lote 2';
const seg = (h: string) => h.split(':').map(Number).reduce((a, n) => a * 60 + n, 0);
const hora = (s: number) => [s / 3600, (s % 3600) / 60, s % 60].map((n) => String(Math.floor(n)).padStart(2, '0')).join(':');
const r2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const r = await p.tiemposProduccion.findUnique({ where: { id: ID } });
  if (!r) throw new Error('no está el registro');
  if (r.sku !== 'ZAT-BIK-CUADRJ-001' || r.maquina !== 'Collareta' || r.lote !== 1 || r.horaInicio !== '10:19:47' || r.horaFin !== '10:50:04') {
    throw new Error(`el registro cambió (¿ya se partió?): ${r.sku} ${r.maquina} L${r.lote} ${r.horaInicio}-${r.horaFin} ${r.minutosNetos}`);
  }
  const ini = seg(r.horaInicio!), fin = seg(r.horaFin!);
  const m1 = r2(r.minutosNetos - MIN_LOTE2);
  const corte = hora(Math.round(ini + (fin - ini) * (m1 / r.minutosNetos)));
  console.log(`${r.fecha} ${r.horaInicio}-${r.horaFin} ${r.minutosNetos} min ⇒ Lote 1 ${r.horaInicio}-${corte} ${m1} · Lote 2 ${corte}-${r.horaFin} ${MIN_LOTE2}`);
  if (!aplicar) { console.log('ENSAYO: nada escrito. Repetir con --aplicar.'); return; }

  await p.$transaction([
    p.tiemposProduccion.update({ where: { id: r.id, lote: 1, horaFin: r.horaFin }, data: { horaFin: corte, minutosNetos: m1, detalle: NOTA } }),
    p.tiemposProduccion.create({ data: {
      usuario: r.usuario, actividad: r.actividad, fecha: r.fecha, marca: r.marca, maquina: r.maquina, sku: r.sku, lote: 2,
      parte: r.parte, cantidad: 0, defectos: 0, horaInicio: corte, horaFin: r.horaFin, minutosNetos: MIN_LOTE2, estado: 'guardado', detalle: NOTA,
    } }),
  ]);
  const t = await p.tiemposProduccion.findMany({ where: { sku: r.sku, fecha: r.fecha, maquina: 'Collareta', horaInicio: { gte: '10:19:47' } }, orderBy: { horaInicio: 'asc' } });
  console.log('APLICADO. Releído:');
  for (const x of t) console.log(`  ${x.horaInicio}-${x.horaFin} L${x.lote} ${x.parte} ${x.minutosNetos} ${x.estado}`);
  console.log('  total', r2(t.reduce((s, x) => s + x.minutosNetos, 0)));
}
main().finally(() => p.$disconnect());
