// Enlaza cada producto estampado a su escandallo cuando el escandallo YA EXISTE con el
// mismo SKU de liso. Es una reparación de dato, no una decisión: `productos_estampados`
// guarda el liso de dos formas —`lisoEscandalloId` (hay costo) o `lisoSku` (sólo la
// receta)— y los 13 de Stunned nacieron el 20-ago apuntando al SKU porque todavía no
// había escandallo. Los escandallos aparecieron el 25-ago y nadie volvió a apuntar.
//
// 🔴 El síntoma es peor que "falta un número": la pantalla dice «falta el escandallo»
// cuando el escandallo está ahí, con ese mismo SKU. La pantalla ya prefiere el escandallo
// —`lisosSoloSku` esconde el SKU pelado cuando existe uno con ese sku—, así que el estado
// que arregla esto es el que la propia pantalla habría dejado si el escandallo hubiera
// existido primero.
//
// Medido antes de correr (7-sep-2026): de 149 prendas de la orden de lanzamiento, sólo
// 35 tenían costo. Los otros 114: 72 por esto (el escandallo existe, sin enlazar) y 42
// porque el escandallo del liso NO existe (STU-REM-BOXY-BL y -NG), que ⛔ no lo arregla
// este script — hay que hacer esos dos escandallos.
//
//   npx tsx prisma/migrate-liso-escandallo-por-sku.ts            → sólo informa
//   npx tsx prisma/migrate-liso-escandallo-por-sku.ts --aplicar  → escribe
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
const APLICAR = process.argv.includes('--aplicar');

async function main() {
  const productos = await prisma.productoEstampado.findMany({
    where: { lisoSku: { not: null } },
    orderBy: [{ marca: 'asc' }, { nombre: 'asc' }],
  });
  const escandallos = await prisma.escandallo.findMany({ where: { sku: { not: null } }, select: { id: true, sku: true, nombre: true } });
  const porSku = new Map<string, { id: string; sku: string | null; nombre: string }[]>();
  for (const e of escandallos) {
    const k = e.sku!.trim();
    porSku.set(k, [...(porSku.get(k) ?? []), e]);
  }

  let enlazables = 0, sinEscandallo = 0, ambiguos = 0;
  for (const p of productos) {
    const cands = porSku.get(p.lisoSku!.trim()) ?? [];
    if (cands.length === 0) { sinEscandallo++; console.log(`—  ${p.nombre.padEnd(22)} ${p.lisoSku}  · no existe el escandallo: hay que hacerlo`); continue; }
    // Dos escandallos con el mismo SKU es una ambigüedad real: elegir uno acá sería
    // inventar cuál. Se informa y se deja para que lo resuelva quien sabe.
    if (cands.length > 1) { ambiguos++; console.log(`⚠️  ${p.nombre.padEnd(22)} ${p.lisoSku}  · ${cands.length} escandallos con ese SKU: NO se toca`); continue; }
    enlazables++;
    console.log(`✔️  ${p.nombre.padEnd(22)} ${p.lisoSku}  → ${cands[0].nombre} [${cands[0].id}]`);
    if (APLICAR) {
      await prisma.productoEstampado.update({
        where: { id: p.id },
        // El costo manual convive sólo mientras no haya derivado: con escandallo manda el
        // derivado, y dejar el número al lado sería otro costo compitiendo por el mismo
        // nombre. Es el mismo criterio que aplica el POST de la API.
        data: { lisoEscandalloId: cands[0].id, lisoSku: null, costoFinalManual: null, costoFinalFecha: null, costoFinalFuente: null },
      });
    }
  }
  console.log(`\n${enlazables} enlazables · ${sinEscandallo} sin escandallo · ${ambiguos} ambiguos`);
  console.log(APLICAR ? '✅ aplicado' : '(dry-run: agregar --aplicar para escribir)');
}
main().finally(() => prisma.$disconnect());
