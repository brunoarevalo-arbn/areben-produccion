// Medición read-only antes de la Fase 1 (LoteCorte). NO escribe nada.
//   cd ~/Projects/areben-produccion && npx tsx <este archivo>
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
});

async function main() {
  // ---------- 1. OP por estado ----------
  const porEstado = await prisma.ordenProduccion.groupBy({
    by: ['estado'],
    _count: { _all: true },
  });
  console.log('\n=== 1. OP por estado ===');
  let totalOp = 0;
  for (const e of porEstado.sort((a, b) => b._count._all - a._count._all)) {
    console.log(`  ${e.estado.padEnd(24)} ${e._count._all}`);
    totalOp += e._count._all;
  }
  console.log(`  ${'TOTAL'.padEnd(24)} ${totalOp}`);

  // ---------- 2. costoManoObra: ¿columna muerta? ----------
  const conMo = await prisma.ordenProduccion.count({ where: { NOT: { costoManoObra: 0 } } });
  const conTotal = await prisma.ordenProduccion.count({ where: { NOT: { costoTotal: 0 } } });
  const conTela = await prisma.ordenProduccion.count({ where: { NOT: { costoTela: 0 } } });
  const conCorte = await prisma.ordenProduccion.count({ where: { NOT: { costoCorte: 0 } } });
  console.log('\n=== 2. Costos escritos en la OP (de ' + totalOp + ') ===');
  console.log(`  costoTela   != 0 : ${conTela}`);
  console.log(`  costoCorte  != 0 : ${conCorte}`);
  console.log(`  costoTotal  != 0 : ${conTotal}`);
  console.log(`  costoManoObra != 0 : ${conMo}   <-- si es 0, la columna esta MUERTA`);

  // ---------- 3. ¿Alguien entra en PARTES hoy? ----------
  const movs = await prisma.movimientoTerminado.groupBy({
    by: ['ordenId'],
    where: { origen: 'produccion', ordenId: { not: null } },
    _count: { _all: true },
    _min: { fecha: true },
    _max: { fecha: true },
  });
  console.log('\n=== 3. Ingresos por orden (origen=produccion) ===');
  console.log(`  OP con al menos un ingreso : ${movs.length}`);
  // "tandas" = dias distintos con ingreso, no filas (una tanda escribe 1 fila por talle)
  let variosDias = 0;
  const detalleMulti: string[] = [];
  for (const m of movs) {
    if (!m.ordenId) continue;
    const filas = await prisma.movimientoTerminado.findMany({
      where: { ordenId: m.ordenId, origen: 'produccion' },
      select: { fecha: true, cantidad: true, talle: true },
    });
    const dias = new Set(filas.map((f) => f.fecha.toISOString().slice(0, 10)));
    if (dias.size > 1) {
      variosDias++;
      const op = await prisma.ordenProduccion.findUnique({
        where: { id: m.ordenId },
        select: { sku: true, cantidad: true, cantidadCortada: true },
      });
      detalleMulti.push(
        `    ${op?.sku ?? m.ordenId} — ${dias.size} dias, ${filas.reduce((s, f) => s + f.cantidad, 0)} u ` +
        `(plan ${op?.cantidad}, cortado ${op?.cantidadCortada ?? '-'})`,
      );
    }
  }
  console.log(`  OP que ingresaron en MAS DE UN DIA : ${variosDias}`);
  detalleMulti.forEach((l) => console.log(l));
  if (variosDias === 0) console.log('    (ninguna: hoy el ingreso parcial NO existe en los datos)');

  // ---------- 4. Tiempos: el denominador de la mano de obra ----------
  const tTotal = await prisma.tiemposProduccion.count();
  const tConSku = await prisma.tiemposProduccion.count({ where: { NOT: { sku: null } } });
  const tConSkuVacio = await prisma.tiemposProduccion.count({ where: { sku: '' } });
  const minTotal = await prisma.tiemposProduccion.aggregate({ _sum: { minutosNetos: true } });
  const minConSku = await prisma.tiemposProduccion.aggregate({
    where: { NOT: [{ sku: null }, { sku: '' }] },
    _sum: { minutosNetos: true },
  });
  console.log('\n=== 4. TiemposProduccion: hay con que congelar la mano de obra? ===');
  console.log(`  registros                 : ${tTotal}`);
  console.log(`  con sku (no null)         : ${tConSku}  (vacios '': ${tConSkuVacio})`);
  console.log(`  minutos totales           : ${(minTotal._sum.minutosNetos ?? 0).toFixed(0)}`);
  console.log(`  minutos CON sku           : ${(minConSku._sum.minutosNetos ?? 0).toFixed(0)}`);
  const pct = (minTotal._sum.minutosNetos ?? 0) > 0
    ? (100 * (minConSku._sum.minutosNetos ?? 0)) / (minTotal._sum.minutosNetos ?? 1)
    : 0;
  console.log(`  => ${pct.toFixed(1)}% de los minutos son imputables a un SKU`);

  // ---------- 5. Los minutos con SKU, ¿matchean una OP? ----------
  const skusTiempo = await prisma.tiemposProduccion.groupBy({
    by: ['sku'],
    where: { NOT: [{ sku: null }, { sku: '' }] },
    _sum: { minutosNetos: true },
  });
  const skusOp = new Set(
    (await prisma.ordenProduccion.findMany({ where: { NOT: { sku: null } }, select: { sku: true } }))
      .map((o) => o.sku!)
  );
  let minMatch = 0, minHuerfano = 0;
  const huerfanos: string[] = [];
  for (const s of skusTiempo) {
    const m = s._sum.minutosNetos ?? 0;
    if (s.sku && skusOp.has(s.sku)) minMatch += m;
    else { minHuerfano += m; if (s.sku) huerfanos.push(`${s.sku} (${m.toFixed(0)} min)`); }
  }
  console.log('\n=== 5. De los minutos CON sku, cuantos caen en una OP real ===');
  console.log(`  minutos que matchean una OP : ${minMatch.toFixed(0)}`);
  console.log(`  minutos huerfanos           : ${minHuerfano.toFixed(0)}`);
  if (huerfanos.length) console.log(`    sku sin OP: ${huerfanos.slice(0, 12).join(' · ')}${huerfanos.length > 12 ? ` … +${huerfanos.length - 12}` : ''}`);

  // ---------- 6. Bikinis ----------
  const bikinis = await prisma.ordenProduccion.findMany({
    where: { sku: { contains: 'BIK' } },
    select: { sku: true, estado: true, cantidad: true, cantidadCortada: true, costoTotal: true, marca: true },
  });
  console.log('\n=== 6. OP de bikini ===');
  if (!bikinis.length) console.log('  (ninguna todavia)');
  for (const b of bikinis) {
    console.log(`  ${b.sku} · ${b.marca} · ${b.estado} · plan ${b.cantidad} · cortado ${b.cantidadCortada ?? '-'} · $${b.costoTotal}`);
  }

  // ---------- 7. costoMinuto vigente ----------
  const [gastos, costureras] = await Promise.all([
    prisma.gastoFijoTaller.findMany({ where: { activo: true } }),
    prisma.costoCosturera.findMany(),
  ]);
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
  const totalCosturas = costureras.reduce((s, c) => s + c.sueldoBruto + c.cargasSociales, 0);
  const totalHoras = costureras.reduce((s, c) => s + c.horasMes, 0);
  console.log('\n=== 7. costoMinuto vigente ===');
  console.log(`  gastos fijos activos : $${totalGastos}  (${gastos.length} filas)`);
  console.log(`  costureras           : ${costureras.length}, ${totalHoras} hs/mes, $${totalCosturas}`);
  console.log(`  costoMinuto          : $${totalHoras ? ((totalGastos + totalCosturas) / totalHoras / 60).toFixed(2) : '0 (sin horas cargadas)'}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
