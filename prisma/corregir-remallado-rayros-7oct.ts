// RAYROS: remallado completo y con la proporción MEDIDA (Bruno, 16-oct: «la pieza ponele
// referido al porcentaje, incluso editá los registros: se registró mal, no se separó bien»).
//  1. el hueco del 7-oct 13:31→16:00 (la sesión de la tablet venció; Bruno: «sí, remalló RAYROS»);
//  2. el ALMUERZO del 7-oct pierde SKU/pieza/máquina (se cobraba como remallado);
//  3. el corpiño/bombacha del remallado de RAYROS (antes del 8-oct 11:15, cuando Marisol
//     todavía no cambiaba la pieza en la tablet) se lleva a la proporción de las OTRAS TRES
//     AYLA estampadas, leída de la base: el registro del 7-oct 11:13 se PARTE en dos tramos.
//
//   npx tsx --env-file=.env prisma/corregir-remallado-rayros-7oct.ts            (ensayo)
//   npx tsx --env-file=.env prisma/corregir-remallado-rayros-7oct.ts --aplicar
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
const aplicar = process.argv.includes('--aplicar');
const SKU = 'ZAT-BIK-RAYROS-001';
const ALMUERZO = 'cmuybr66w000004lip6pys856';
const A_PARTIR = 'cmuyaoko7000004jn13vglbbc'; // 7-oct 11:13:48-13:01:12 Corpiño 107,4
const HUECO = { fecha: '2026-10-07', horaInicio: '13:31:13', horaFin: '16:00:00' };
const NOTA = 'Corregido el 16-oct (Bruno): remallado de RAYROS a la proporción medida en las otras AYLA';

const seg = (h: string) => h.split(':').map(Number).reduce((a, n) => a * 60 + n, 0);
const hora = (s: number) => [s / 3600, (s % 3600) / 60, s % 60].map((n) => String(Math.floor(n)).padStart(2, '0')).join(':');
const r2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  // La vara: el remallado de LUNAMA, RAYAZ y CUADNG, todo con pieza (13-oct: 28/72 · 28/72 · 30/70).
  const vara = await p.tiemposProduccion.groupBy({
    by: ['parte'], _sum: { minutosNetos: true },
    where: { sku: { in: ['ZAT-BIK-LUNAMA-001', 'ZAT-BIK-RAYAZ-001', 'ZAT-BIK-CUADNG-001'] }, maquina: 'Remalladora', estado: 'guardado', lote: null },
  });
  const m = (k: string) => vara.find((v) => v.parte === k)?._sum.minutosNetos ?? 0;
  if (vara.some((v) => v.parte !== 'Corpiño' && v.parte !== 'Bombacha')) throw new Error('la vara tiene registros sin pieza: ' + JSON.stringify(vara));
  const pctCorpino = m('Corpiño') / (m('Corpiño') + m('Bombacha'));

  const alm = await p.tiemposProduccion.findUnique({ where: { id: ALMUERZO } });
  if (alm?.actividad !== 'Almuerzo' || alm.sku !== SKU) throw new Error('el almuerzo no está como se leyó');
  const a = await p.tiemposProduccion.findUnique({ where: { id: A_PARTIR } });
  if (!a || a.sku !== SKU || a.parte !== 'Corpiño' || a.horaInicio !== '11:13:48' || a.horaFin !== '13:01:12') throw new Error('el registro a partir cambió');
  const dia = await p.tiemposProduccion.findMany({ where: { fecha: HUECO.fecha, usuario: 'Marisol' } });
  const pisa = dia.filter((r) => r.horaInicio && r.horaFin && seg(r.horaInicio) < seg(HUECO.horaFin) && seg(r.horaFin) > seg(HUECO.horaInicio));
  if (pisa.length) throw new Error('ya hay registros en el hueco: ' + pisa.map((r) => r.id).join(', '));

  const actuales = await p.tiemposProduccion.findMany({ where: { sku: SKU, maquina: 'Remalladora', estado: 'guardado', actividad: 'Proceso Completado' } });
  const hueco = r2((seg(HUECO.horaFin) - seg(HUECO.horaInicio)) / 60);
  const total = actuales.reduce((s, r) => s + r.minutosNetos, 0) + hueco;
  const corpinoHoy = actuales.filter((r) => r.parte === 'Corpiño').reduce((s, r) => s + r.minutosNetos, 0);
  if (actuales.some((r) => r.parte !== 'Corpiño' && r.parte !== 'Bombacha')) throw new Error('hay remallado de RAYROS sin pieza o compartido');
  const corpinoMeta = total * pctCorpino;
  const pasar = r2(corpinoHoy - corpinoMeta); // minutos de corpiño que en verdad fueron bombacha
  if (pasar <= 0 || pasar >= a.minutosNetos) throw new Error(`no se puede partir: pasar ${pasar} de ${a.minutosNetos}`);
  const corte = hora(Math.round(seg(a.horaInicio!) + (a.minutosNetos - pasar) * 60));

  console.log(`vara: corpiño ${r2(m('Corpiño'))} / bombacha ${r2(m('Bombacha'))} ⇒ ${r2(pctCorpino * 100)}% corpiño`);
  console.log(`RAYROS remallado con el hueco: ${r2(total)} min ⇒ corpiño ${r2(corpinoMeta)} · bombacha ${r2(total - corpinoMeta)}`);
  console.log(`+ hueco ${HUECO.fecha} ${HUECO.horaInicio}-${HUECO.horaFin} · Bombacha · ${hueco} min`);
  console.log(`~ ${A_PARTIR}: Corpiño 11:13:48-${corte} ${r2(a.minutosNetos - pasar)} min  +  nuevo Bombacha ${corte}-13:01:12 ${pasar} min`);
  console.log(`~ almuerzo ${ALMUERZO}: sin SKU, pieza, máquina ni marca`);
  if (!aplicar) { console.log('\nENSAYO: nada escrito. Repetir con --aplicar.'); return; }

  const base = { usuario: 'Marisol', actividad: 'Proceso Completado', marca: 'Zattia', maquina: 'Remalladora', sku: SKU, estado: 'guardado', detalle: NOTA };
  await p.$transaction([
    p.tiemposProduccion.create({ data: { ...base, ...HUECO, parte: 'Bombacha', minutosNetos: hueco } }),
    p.tiemposProduccion.update({ where: { id: A_PARTIR, horaFin: '13:01:12' }, data: { horaFin: corte, minutosNetos: r2(a.minutosNetos - pasar), detalle: NOTA } }),
    p.tiemposProduccion.create({ data: { ...base, fecha: a.fecha, horaInicio: corte, horaFin: '13:01:12', parte: 'Bombacha', minutosNetos: pasar } }),
    p.tiemposProduccion.update({ where: { id: ALMUERZO, actividad: 'Almuerzo' }, data: { sku: null, parte: null, maquina: null, marca: null } }),
  ]);
  const t = await p.tiemposProduccion.groupBy({ by: ['parte'], where: { sku: SKU, maquina: 'Remalladora', estado: 'guardado' }, _sum: { minutosNetos: true } });
  console.log('\nAPLICADO. Releído:', t.map((x) => `${x.parte} ${r2(x._sum.minutosNetos ?? 0)}`).join(' · '));
}
main().finally(() => p.$disconnect());
