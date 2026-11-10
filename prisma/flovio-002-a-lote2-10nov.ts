// 10-nov-2026, Bruno: «la flovio que entre como lote 2 completo, de un mismo sku, no hagas dos sku».
// El corte del 9-nov de flores violetas (S8·M8·L4 = 20) se había cargado como ZAT-BIK-FLOVIO-002
// (`cargar-nya-tayra-9nov.ts`) y validado a $450 (`fernando-valida-9nov.ts`). Pasa a ser el LOTE 2
// de ZAT-BIK-FLOVIO-001, entero (8·8·4), y la -002 se borra.
//
// FLOVIO-001: cantidad y cortadas 20 → 40 · talles de la ficha 8·8·4 → 16·16·8 · costoCorte validado
// $9.000 → $18.000 (= $450 × 40, la regla de validar-corte) ⇒ la cuenta de Fernando ⛔ cambia de saldo.
// Lote 2: «Todo cortado», activado y OCULTO (🙈), como los Lote 2 de las otras NYA.
// Se planta si la -002 tiene algo colgado además de sus lotes e historial (tiempos, ingresos, fallas…).
//
//   npx tsx --env-file=.env prisma/flovio-002-a-lote2-10nov.ts            # muestra el plan
//   npx tsx --env-file=.env prisma/flovio-002-a-lote2-10nov.ts --aplicar
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { cuentaDe } from '../lib/produccion/cuenta-cortador';

const APLICAR = process.argv.includes('--aplicar');
const A = 'ZAT-BIK-FLOVIO-001';
const B = 'ZAT-BIK-FLOVIO-002';
const L2 = { S: 8, M: 8, L: 4 };
const TALLES = ['S', 'M', 'L'] as const;

async function main() {
  console.log(APLICAR ? '▶ APLICANDO' : '◻ SÓLO PLAN (agregá --aplicar para escribir)');
  const inc = { lotesPlanificados: { include: { talles: true, ingresos: true, fallas: true } }, fallas: true, lotesCorte: true,
    cortesPorTalle: true, edicionesCorte: true, avios: true, movimientosInsumo: true } as const;
  const a = await prisma.ordenProduccion.findUniqueOrThrow({ where: { sku: A }, include: inc });
  const b = await prisma.ordenProduccion.findUniqueOrThrow({ where: { sku: B }, include: inc });
  const bruno = await prisma.usuario.findFirstOrThrow({ where: { email: 'brunoarevalo@arebensrl.com' } });

  // Lo que se espera encontrar.
  if (a.cantidad !== 20 || a.cantidadCortada !== 20 || a.corteEstado !== 'validado' || Number(a.costoCorte) !== 9000) throw new Error(`${A} no está como se espera`);
  if (a.lotesPlanificados.length !== 1 || a.lotesPlanificados[0].numero !== 1) throw new Error(`${A}: esperaba sólo el Lote 1`);
  if (b.cantidadCortada !== 20 || b.corteEstado !== 'validado' || Number(b.costoCorte) !== 9000 || b.cortadorId !== a.cortadorId) throw new Error(`${B} no está como se espera`);
  if (b.fallas.length || b.lotesCorte.length || b.cortesPorTalle.length || b.edicionesCorte.length || b.avios.length || b.movimientosInsumo.length ||
      b.lotesPlanificados.some((l) => l.ingresos.length || l.fallas.length)) throw new Error(`${B} tiene cosas colgadas: no la borro`);
  const tiempos = await prisma.tiemposProduccion.count({ where: { sku: B } });
  const terminado = await prisma.movimientoTerminado.count({ where: { OR: [{ sku: { startsWith: B } }, { ordenId: b.id }] } });
  if (tiempos || terminado) throw new Error(`${B}: ${tiempos} tiempos, ${terminado} movimientos de terminado`);

  const fd = a.fichaCorteData as Record<string, unknown>;
  const ficha = { ...fd, talles: { S: '16', M: '16', L: '8' }, cantidadPrevia: 40 };
  const cuenta = await cuentaDe(a.cortadorId!);
  console.log(`${A}: 20 → 40 · corte $9.000 → $18.000 · Lote 1 8·8·4 (queda) + Lote 2 8·8·4 🙈 · borro ${B}`);
  console.log('Cuenta ANTES', JSON.stringify(cuenta));
  if (!APLICAR) return;

  await prisma.$transaction(async (tx) => {
    await tx.ordenProduccion.delete({ where: { id: b.id } });
    await tx.ordenProduccion.update({ where: { id: a.id }, data: {
      cantidad: 40, cantidadCortada: 40, costoCorte: new Prisma.Decimal(18000), fichaCorteData: ficha as Prisma.InputJsonValue,
      notas: `${a.notas ?? ''}\n2º corte 9-nov (Fernando, S8·M8·L4 = 20, tizada NYA 1,30 × 10 con las flores naranjas, $450/u) = Lote 2.`.trim() } });
    await tx.lotePlanificado.create({ data: { ordenId: a.id, numero: 2, despuesDe: 'Todo cortado', separadoPor: bruno.nombre,
      activadoAt: new Date(), enTaller: false, talles: { create: TALLES.map((t) => ({ talle: t, cantidad: L2[t] })) } } });
    await tx.estadoTransicion.create({ data: { ordenId: a.id, estadoAnterior: 'COSTURA', estadoNuevo: 'COSTURA', usuarioId: bruno.id,
      notas: `Corte 9-nov sumado como Lote 2 (S8·M8·L4, oculto): 40 cortadas, corte validado $18.000. Era ${B}, borrada.` } });
  });

  const r = await prisma.ordenProduccion.findUniqueOrThrow({ where: { sku: A }, include: { lotesPlanificados: { include: { talles: true }, orderBy: { numero: 'asc' } } } });
  console.log('RELEÍDO', A, r.cantidad, r.cantidadCortada, r.corteEstado, String(r.costoCorte), JSON.stringify((r.fichaCorteData as Record<string, unknown>).talles),
    r.lotesPlanificados.map((l) => `L${l.numero}${l.enTaller ? '' : '🙈'} ${TALLES.map((t) => l.talles.find((x) => x.talle === t)?.cantidad).join('·')}`).join(' | '));
  console.log(B, (await prisma.ordenProduccion.findUnique({ where: { sku: B } })) ? '❌ SIGUE' : 'borrada ✅');
  const despues = await cuentaDe(a.cortadorId!);
  console.log('Cuenta DESPUÉS', JSON.stringify(despues), despues.saldo === cuenta.saldo ? '✅ mismo saldo' : '❌ CAMBIÓ EL SALDO');
}
main().catch((e) => { console.error('❌', e.message ?? e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
