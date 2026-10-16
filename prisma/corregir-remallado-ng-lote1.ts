// AYLA NEGRA Lote 1: remallado a la proporción MEDIDA en su Lote 2 (Bruno, 16-oct: «dale, corregí»).
// En el Lote 1 Marisol hacía un par de bombachas y un par de corpiños sin cambiar la pieza en la
// tablet; el Lote 2 se hizo separado (toda la bombacha, después todo el corpiño) ⇒ es la vara.
// Lo que sobra de corpiño se pasa a bombacha PARTIENDO el registro del 29-sep 08:24, que viene
// pegado al último tramo de bombacha (08:02-08:24).
//
//   npx tsx --env-file=.env prisma/corregir-remallado-ng-lote1.ts            (ensayo)
//   npx tsx --env-file=.env prisma/corregir-remallado-ng-lote1.ts --aplicar
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
const aplicar = process.argv.includes('--aplicar');
const SKU = 'ZAT-BIK-NG-001';
const NOTA = 'Corregido el 16-oct (Bruno): remallado del Lote 1 a la proporción medida en el Lote 2';

const seg = (h: string) => h.split(':').map(Number).reduce((a, n) => a * 60 + n, 0);
const hora = (s: number) => [s / 3600, (s % 3600) / 60, s % 60].map((n) => String(Math.floor(n)).padStart(2, '0')).join(':');
const r2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const rem = await p.tiemposProduccion.findMany({ where: { sku: SKU, maquina: 'Remalladora', estado: 'guardado', actividad: 'Proceso Completado' } });
  const suma = (lote: number, parte: string) => rem.filter((r) => r.lote === lote && r.parte === parte).reduce((s, r) => s + r.minutosNetos, 0);
  if (rem.some((r) => r.parte !== 'Corpiño' && r.parte !== 'Bombacha')) throw new Error('hay remallado sin pieza o compartido');
  const pct = suma(2, 'Corpiño') / (suma(2, 'Corpiño') + suma(2, 'Bombacha'));
  const total1 = suma(1, 'Corpiño') + suma(1, 'Bombacha');
  const pasar = r2(suma(1, 'Corpiño') - total1 * pct);

  const a = rem.find((r) => r.lote === 1 && r.fecha === '2026-09-29' && r.parte === 'Corpiño' && r.horaInicio === '08:24:47');
  if (!a || a.horaFin !== '10:01:01') throw new Error('el registro a partir cambió');
  if (pasar <= 0 || pasar >= a.minutosNetos) throw new Error(`no se puede partir: pasar ${pasar} de ${a.minutosNetos}`);
  const corte = hora(Math.round(seg(a.horaInicio!) + pasar * 60));

  console.log(`vara Lote 2: corpiño ${r2(suma(2, 'Corpiño'))} / bombacha ${r2(suma(2, 'Bombacha'))} ⇒ ${r2(pct * 100)}% corpiño`);
  console.log(`Lote 1 hoy: corpiño ${r2(suma(1, 'Corpiño'))} · bombacha ${r2(suma(1, 'Bombacha'))} ⇒ meta corpiño ${r2(total1 * pct)}`);
  console.log(`~ ${a.id}: nuevo Bombacha 08:24:47-${corte} ${pasar} min  +  Corpiño ${corte}-10:01:01 ${r2(a.minutosNetos - pasar)} min`);
  if (!aplicar) { console.log('\nENSAYO: nada escrito. Repetir con --aplicar.'); return; }

  await p.$transaction([
    p.tiemposProduccion.create({ data: {
      usuario: a.usuario, actividad: a.actividad, fecha: a.fecha, marca: a.marca, maquina: a.maquina, sku: SKU, lote: 1,
      parte: 'Bombacha', horaInicio: a.horaInicio, horaFin: corte, minutosNetos: pasar, estado: 'guardado', detalle: NOTA,
    } }),
    p.tiemposProduccion.update({ where: { id: a.id, horaInicio: '08:24:47' }, data: { horaInicio: corte, minutosNetos: r2(a.minutosNetos - pasar), detalle: NOTA } }),
  ]);
  const t = await p.tiemposProduccion.groupBy({ by: ['lote', 'parte'], where: { sku: SKU, maquina: 'Remalladora', estado: 'guardado' }, _sum: { minutosNetos: true } });
  console.log('\nAPLICADO. Releído:', t.map((x) => `L${x.lote} ${x.parte} ${r2(x._sum.minutosNetos ?? 0)}`).join(' · '));
}
main().finally(() => p.$disconnect());
