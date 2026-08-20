// Vincula las 13 estampas de la orden de Stunned del 20-ago-2026 a su liso, creando un
// `ProductoEstampado` por diseño. Hasta la Etapa 2 del plan esto no se podía para 9 de
// los 13: `lisoEscandalloId` era NOT NULL y sólo 4 de los 9 lisos tienen escandallo.
// Los otros van con `lisoSku` — la receta queda declarada, el costo queda pendiente del
// escandallo (la pantalla lo dice, no muestra un total incompleto).
//
// ⚠ `tiempos_estampado` está VACÍO, así que `minutosEstampado` sale 0 y la mano de obra
//   de estampado de estos 13 va en cero hasta que se cargue una tanda real desde
//   /estamperia/tiempos. Eso es falta de dato, no de código.
//
// Idempotente: no crea uno si ya hay un producto con esa estampa.
//
//   npx tsx prisma/migrate-productos-stunned-ago26.ts            → sólo informa
//   npx tsx prisma/migrate-productos-stunned-ago26.ts --aplicar  → escribe
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
const APLICAR = process.argv.includes('--aplicar');

// codigo → liso. El escandallo se resuelve por `Escandallo.sku`; si no hay, va el SKU.
const LISO_POR_ESTAMPA: Record<string, string> = {
  'EST-020': 'STU-REM-BOXY-NG',
  'EST-021': 'STU-REM-OVER-MAR',
  'EST-022': 'STU-REM-OVER-MAR',
  'EST-023': 'STU-REM-OVER-MAR',
  'EST-024': 'STU-REM-BOXY-BL',
  'EST-025': 'STU-REM-BOXY-BL',
  'EST-026': 'STU-REM-OVER-BL',
  'EST-027': 'STU-REM-OVER-BL',
  'EST-028': 'STU-BUZ-OVER-NG',
  'EST-029': 'STU-BUZ-NG-001',
  'EST-030': 'STU-BUZ-GR-001',
  'EST-031': 'STU-BUZ-AZ-001',
  'EST-032': 'STU-CAMPERA-BOXY-001-NG',
};

async function main() {
  const codigos = Object.keys(LISO_POR_ESTAMPA);
  const estampas = await prisma.estampa.findMany({ where: { codigoInterno: { in: codigos } }, select: { id: true, codigoInterno: true, nombreComercial: true } });
  const faltan = codigos.filter((c) => !estampas.some((e) => e.codigoInterno === c));
  if (faltan.length) throw new Error(`Faltan estampas en la base: ${faltan.join(', ')}`);

  // El escandallo se busca por SKU, no por id hardcodeado: un id pegado en un script
  // envejece mal y falla mudo si alguien rehace el escandallo.
  const skus = [...new Set(Object.values(LISO_POR_ESTAMPA))];
  const escandallos = await prisma.escandallo.findMany({ where: { sku: { in: skus } }, select: { id: true, sku: true, marca: true } });
  const escPorSku = new Map(escandallos.map((e) => [e.sku!, e]));

  const yaVinculadas = new Set(
    (await prisma.productoEstampado.findMany({ select: { estampas: true } }))
      .flatMap((p) => Array.isArray(p.estampas) ? (p.estampas as { estampaId?: string }[]).map((x) => x.estampaId).filter((x): x is string => !!x) : [])
  );

  const nuevos = estampas
    .filter((e) => !yaVinculadas.has(e.id))
    .map((e) => {
      const sku = LISO_POR_ESTAMPA[e.codigoInterno];
      const esc = escPorSku.get(sku);
      return {
        nombre: e.nombreComercial?.trim() || e.codigoInterno,
        marca: 'Stunned',
        lisoEscandalloId: esc?.id ?? null,
        lisoSku: esc ? null : sku,
        // minutosEstampado en 0: `tiempos_estampado` está vacío. Se completa después
        // desde Costos → Productos con estampa → Editar tiempos.
        estampas: [{ estampaId: e.id, tamano: 1, minutosEstampado: 0 }],
        notas: 'Orden de estampa Stunned 20-ago-2026',
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const conEsc = nuevos.filter((p) => p.lisoEscandalloId).length;
  console.log(`${estampas.length} estampas · ${yaVinculadas.size ? `${estampas.length - nuevos.length} ya vinculadas · ` : ''}${nuevos.length} a crear`);
  console.log(`   ${conEsc} con escandallo (traen costo) · ${nuevos.length - conEsc} sólo con SKU (quedan sin costo hasta que se les haga el escandallo)`);
  for (const p of nuevos) console.log(`   ${p.lisoEscandalloId ? '✓' : '·'} ${p.nombre.padEnd(16)} ${p.lisoEscandalloId ? 'escandallo' : `sku ${p.lisoSku}`}`);

  if (!APLICAR) { console.log('\n(dry run — no se escribió nada; correr con --aplicar)'); return; }
  if (nuevos.length === 0) { console.log('\nNada para crear.'); return; }

  const r = await prisma.productoEstampado.createMany({ data: nuevos });
  console.log(`\nCreados: ${r.count}`);
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
