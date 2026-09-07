// Integra los 13 del lanzamiento con Gestión Nube, SKU por SKU. Son dos ataduras y hacen
// cosas distintas:
//
//   1. `productos_estampados.sku` ← la familia de SKU de GN (STU-REM-0024). Hasta hoy los
//      13 tenían el SKU en NULL: el costo existía pero no estaba atado a nada del mundo
//      real, así que ⛔ nadie podía cruzarlo con una venta.
//   2. `reposicion_mapeo` (gnId ↔ skuLiso) ← qué LISO consume cada producto de GN. Es lo
//      que hace que Reposición sepa de dónde sale cada estampado y que Precios encuentre
//      el costo por SKU.
//
// 🔑 En GN el SKU ⛔ NO está en el producto: está en cada VARIANTE por talle
// (`STU-REM-0024-S/M/L/XL`), y el `code` del producto viene en null. La familia es el SKU
// sin el sufijo del talle, y es lo que se guarda acá.
//
// 🔑 La tabla va escrita a mano y con el NOMBRE de GN al lado, ⛔ no derivada por
// coincidencia de texto: "MADE" es a la vez una remera y un buzo, y un match por nombre
// los cruzaría sin que nadie lo note.
//
//   npx tsx prisma/migrate-integrar-gn-stunned.ts            → sólo informa
//   npx tsx prisma/migrate-integrar-gn-stunned.ts --aplicar  → escribe
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
const APLICAR = process.argv.includes('--aplicar');

// gnId · nombre en GN · familia de SKU · nombre del producto en productos_estampados
const MAPA: { gnId: number; gnNombre: string; sku: string; producto: string }[] = [
  { gnId: 1097609, gnNombre: 'REMERA SKATE',          sku: 'STU-REM-0024', producto: 'SKATE' },
  { gnId: 913520,  gnNombre: 'REMERA CIRCLE BROWN',   sku: 'STU-REM-0016', producto: 'CIRCLE BROWN' },
  { gnId: 1097608, gnNombre: 'REMERA TIME',           sku: 'STU-REM-0023', producto: 'TIME' },
  { gnId: 1097606, gnNombre: 'REMERA GRAPH',          sku: 'STU-REM-0021', producto: 'GRAPH' },
  { gnId: 1097607, gnNombre: 'REMERA MADE',           sku: 'STU-REM-0022', producto: 'MADE' },
  { gnId: 1097604, gnNombre: 'REMERA STARRY',         sku: 'STU-REM-0019', producto: 'STARRY' },
  { gnId: 1097605, gnNombre: 'REMERA LONG BROWN',     sku: 'STU-REM-0020', producto: 'LONG BROWN' },
  { gnId: 1097610, gnNombre: 'REMERA LONG OFF WHITE', sku: 'STU-REM-0025', producto: 'LONG OFF WHITE' },
  { gnId: 1097603, gnNombre: 'BUZO FLECK',            sku: 'STU-BUZ-0013', producto: 'BUZO FLECK' },
  { gnId: 1097611, gnNombre: 'BUZO MADE',             sku: 'STU-BUZ-0014', producto: 'BUZO MADE' },
  { gnId: 1097602, gnNombre: 'BUZO PHRASE',           sku: 'STU-BUZ-0012', producto: 'BUZO PHRASE' },
  { gnId: 1097601, gnNombre: 'BUZO STND',             sku: 'STU-BUZ-0011', producto: 'BUZO STND' },
  { gnId: 1097600, gnNombre: 'CAMPERA WEAR',          sku: 'CAM-0001',     producto: 'CAMPERA WEAR' },
];

async function main() {
  const productos = await prisma.productoEstampado.findMany({ where: { marca: 'Stunned' } });
  const escandallos = await prisma.escandallo.findMany({ select: { id: true, sku: true } });
  const skuEsc = new Map(escandallos.map((e) => [e.id, e.sku]));

  let nuevos = 0, actualizados = 0, problemas = 0;
  for (const m of MAPA) {
    const p = productos.find((x) => x.nombre === m.producto);
    if (!p) { console.log(`⛔ ${m.producto}: no existe en productos_estampados`); problemas++; continue; }
    const liso = p.lisoEscandalloId ? skuEsc.get(p.lisoEscandalloId) : null;
    if (!liso) { console.log(`⛔ ${m.producto}: no tiene liso con SKU ⇒ Reposición no sabría qué descontar`); problemas++; continue; }

    const mapeo = await prisma.reposicionMapeo.findUnique({ where: { gnId: m.gnId } });
    const accion = mapeo ? (mapeo.skuLiso === liso ? 'ya está' : `CAMBIA liso ${mapeo.skuLiso} → ${liso}`) : 'nuevo';
    console.log(`${m.gnNombre.padEnd(24)} gn ${m.gnId} · sku ${m.sku.padEnd(13)} · liso ${liso.padEnd(20)} · mapeo: ${accion}${p.sku === m.sku ? '' : `  (sku del producto: ${p.sku ?? '—'} → ${m.sku})`}`);

    if (APLICAR) {
      if (p.sku !== m.sku) await prisma.productoEstampado.update({ where: { id: p.id }, data: { sku: m.sku } });
      await prisma.reposicionMapeo.upsert({
        where: { gnId: m.gnId },
        create: { gnId: m.gnId, gnNombre: m.gnNombre, skuLiso: liso, tipo: 'estampa', activo: true },
        update: { gnNombre: m.gnNombre, skuLiso: liso, tipo: 'estampa', activo: true },
      });
      mapeo ? actualizados++ : nuevos++;
    }
  }
  console.log(`\n${MAPA.length} productos · ${problemas} con problema` + (APLICAR ? ` · ${nuevos} mapeos nuevos, ${actualizados} actualizados` : ''));
  console.log(APLICAR ? '✅ aplicado' : '(dry-run: agregar --aplicar para escribir)');
}
main().finally(() => prisma.$disconnect());
