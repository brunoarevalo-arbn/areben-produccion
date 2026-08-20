// Carga la orden de estampa de Stunned del 20-ago-2026 (13 diseños × 4 talles = 149
// prendas) como UNA orden de `origen: 'lanzamiento'`. Hasta la Etapa 1 del plan esto no
// se podía: `ordenes_estampa_items.gnId` era NOT NULL y estos 13 diseños todavía no
// existen en Gestión Nube.
//
// 🔴 La orden se crea en `pendiente`, con `confirmado = 0`: EL LISO SE DESCUENTA AL
//    CONFIRMAR EN LA APP, no acá. Confirmar sólo lo que realmente se estampó.
//
// Idempotente: si ya existe una orden con esta nota, no la duplica.
//
//   npx tsx prisma/migrate-orden-stunned-ago26.ts            → sólo informa (dry run)
//   npx tsx prisma/migrate-orden-stunned-ago26.ts --aplicar  → escribe
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
const APLICAR = process.argv.includes('--aplicar');
const NOTA = 'Orden de estampa Stunned 20-ago-2026 (lanzamiento)';

// [codigo, liso, S, M, L, XL]
const TABLA: [string, string, number, number, number, number][] = [
  ['EST-020', 'STU-REM-BOXY-NG',         3, 6, 6, 3],
  ['EST-021', 'STU-REM-OVER-MAR',        2, 4, 4, 2],
  ['EST-022', 'STU-REM-OVER-MAR',        2, 4, 4, 2],
  ['EST-023', 'STU-REM-OVER-MAR',        2, 4, 4, 2],
  ['EST-024', 'STU-REM-BOXY-BL',         2, 4, 4, 2],
  ['EST-025', 'STU-REM-BOXY-BL',         2, 4, 4, 2],
  ['EST-026', 'STU-REM-OVER-BL',         2, 4, 4, 2],
  ['EST-027', 'STU-REM-OVER-BL',         2, 4, 4, 2],
  ['EST-028', 'STU-BUZ-OVER-NG',         2, 4, 4, 2],
  ['EST-029', 'STU-BUZ-NG-001',          2, 2, 2, 2],
  ['EST-030', 'STU-BUZ-GR-001',          2, 2, 2, 2],
  ['EST-031', 'STU-BUZ-AZ-001',          2, 2, 2, 2],
  // El XL de la campera va en 1 y no en 2 A PROPÓSITO: el liso tiene un solo XL y
  // queda 1 pendiente que se salda cortando, no con stock.
  ['EST-032', 'STU-CAMPERA-BOXY-001-NG', 2, 4, 4, 1],
];
const TALLES = ['S', 'M', 'L', 'XL'] as const;

async function main() {
  const yaEsta = await prisma.ordenEstampa.findFirst({ where: { notas: NOTA }, include: { items: true } });
  if (yaEsta) {
    const total = yaEsta.items.reduce((s, i) => s + i.cantidad, 0);
    console.log(`Ya existe: orden ${yaEsta.id} · ${yaEsta.items.length} ítems · ${total} prendas · estado ${yaEsta.estado}. No se duplica.`);
    return;
  }

  const codigos = TABLA.map((f) => f[0]);
  const estampas = await prisma.estampa.findMany({ where: { codigoInterno: { in: codigos } }, select: { id: true, codigoInterno: true } });
  const byCodigo = new Map(estampas.map((e) => [e.codigoInterno, e.id]));
  const faltan = codigos.filter((c) => !byCodigo.has(c));
  if (faltan.length) throw new Error(`Faltan estampas en la base: ${faltan.join(', ')}`);

  const items = TABLA.flatMap(([codigo, skuLiso, ...cant]) =>
    TALLES.map((talle, i) => ({ estampaId: byCodigo.get(codigo)!, skuLiso, talle, cantidad: cant[i] }))
      .filter((it) => it.cantidad > 0));

  // Contraste contra el stock de liso: no frena nada (el descuento es al confirmar),
  // pero si un talle no alcanza hay que saberlo ANTES de mandar a estampar.
  const stock = await prisma.stockTerminado.findMany({ where: { sku: { in: [...new Set(items.map((i) => i.skuLiso))] }, tipo: 'liso' } });
  const hay = new Map(stock.map((s) => [`${s.sku}::${s.talle}`, s.cantidad]));
  const pedidoPorLiso = new Map<string, number>();
  for (const it of items) {
    const k = `${it.skuLiso}::${it.talle}`;
    pedidoPorLiso.set(k, (pedidoPorLiso.get(k) ?? 0) + it.cantidad);
  }
  const cortos = [...pedidoPorLiso.entries()].filter(([k, ped]) => (hay.get(k) ?? 0) < ped);

  const total = items.reduce((s, i) => s + i.cantidad, 0);
  const porTalle = TALLES.map((t) => `${t} ${items.filter((i) => i.talle === t).reduce((s, i) => s + i.cantidad, 0)}`).join(' · ');
  console.log(`${items.length} ítems · ${total} prendas · ${porTalle}`);
  if (cortos.length) {
    console.log('⚠ liso que no alcanza:');
    for (const [k, ped] of cortos) console.log(`   ${k} → pide ${ped}, hay ${hay.get(k) ?? 0}`);
  } else {
    console.log('✓ el stock de liso alcanza en los 9 lisos, en los 4 talles');
  }

  if (!APLICAR) { console.log('\n(dry run — no se escribió nada; correr con --aplicar)'); return; }

  const orden = await prisma.ordenEstampa.create({
    data: {
      creadoPor: 'Bruno Arevalo', tipo: 'estampa', origen: 'lanzamiento', notas: NOTA,
      items: { create: items },
    },
    include: { items: true },
  });
  await prisma.estampa.updateMany({ where: { codigoInterno: { in: codigos }, estado: 'pensada' }, data: { estado: 'pedida' } });
  console.log(`\nCreada: ${orden.id} · ${orden.items.length} ítems · estado ${orden.estado} · confirmado 0 (el liso NO se descontó)`);
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
