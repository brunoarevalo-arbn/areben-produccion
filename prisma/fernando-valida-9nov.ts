// 10-nov-2026, pedido de Bruno: validar a $450/u los cortes del 9-nov de Fernando
// (cargados por `cargar-nya-tayra-9nov.ts`). Misma regla que POST /api/produccion/cola/[id]/validar-corte.
// Sin pago. Sin --aplicar sólo muestra.
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { cantidadCortada } from '../lib/produccion/cantidades';
import { cuentaDe } from '../lib/produccion/cuenta-cortador';

const APLICAR = process.argv.includes('--aplicar');
const SKUS = ['ZAT-BIK-FLONAR-001', 'ZAT-BIK-FLOVIO-002', 'ZAT-BIK-CAMROS-001'];
const PRECIO = 450;
const ESPERADO = 120 * PRECIO; // 54.000

async function main() {
  const f = await prisma.cortador.findFirst({ where: { nombre: 'Fernando', activo: true }, select: { id: true, nombre: true } });
  if (!f) throw new Error('No está Fernando');
  console.log(APLICAR ? '▶ APLICANDO' : '◻ SÓLO PLAN (agregá --aplicar para escribir)');
  console.log('ANTES', JSON.stringify(await cuentaDe(f.id)));

  const ops = await prisma.ordenProduccion.findMany({ where: { sku: { in: SKUS } }, select: { id: true, sku: true, cantidad: true, cantidadCortada: true, corteEstado: true, fichaCorteCargada: true, cortadorId: true, fechaCorte: true, fichaCorteData: true } });
  if (ops.length !== SKUS.length) throw new Error(`Esperaba ${SKUS.length} OP, hay ${ops.length}`);

  const cambios = ops.map((o) => {
    const fd = o.fichaCorteData as Record<string, unknown> | null;
    if (o.cortadorId !== f.id) throw new Error(`${o.sku} no es de Fernando`);
    if (o.corteEstado !== 'cargado' || o.fichaCorteCargada) throw new Error(`${o.sku} no está para validar: ${o.corteEstado}`);
    if (fd?.modoCosto !== 'unidad' || Number(fd?.costoCorte) !== PRECIO) throw new Error(`${o.sku}: ${fd?.modoCosto} $${fd?.costoCorte}`);
    const total = PRECIO * cantidadCortada(o);
    const fechaCorte = typeof fd?.fechaCorte === 'string' ? new Date(`${fd.fechaCorte}T12:00:00Z`) : (o.fechaCorte ?? new Date());
    console.log(`VALIDAR ${o.sku}: ${cantidadCortada(o)} u × $${PRECIO} = $${total}`);
    return { id: o.id, total, fechaCorte };
  });
  const suma = cambios.reduce((s, c) => s + c.total, 0);
  if (suma !== ESPERADO) throw new Error(`Suma $${suma}, esperaba $${ESPERADO}`);
  console.log(`TOTAL $${suma}`);
  if (!APLICAR) return;

  await prisma.$transaction(cambios.map((c) => prisma.ordenProduccion.update({
    where: { id: c.id }, data: { costoCorte: new Prisma.Decimal(c.total), corteEstado: 'validado', cortador: f.nombre, fechaCorte: c.fechaCorte } })));

  const rel = await prisma.ordenProduccion.findMany({ where: { sku: { in: SKUS } }, select: { sku: true, corteEstado: true, costoCorte: true, cortador: true } });
  console.log('RELEÍDO', JSON.stringify(rel));
  console.log('DESPUÉS', JSON.stringify(await cuentaDe(f.id)));
}
main().catch((e) => { console.error('❌', e.message ?? e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
