// Dije ×1 (sólo bombacha, por catálogo) en las 4 AYLA sublimadas (Bruno, 19-oct: «ayla sublimadas sí llevan dije»).
//   npx tsx --env-file=.env prisma/dije-ayla-sublimadas.ts [--aplicar]
import { prisma } from '../lib/prisma';
const SKUS = ['RAYROS', 'RAYAZ', 'LUNAMA', 'CUADNG'].map((c) => `ZAT-BIK-${c}-001`);
async function main() {
  const aplicar = process.argv.includes('--aplicar');
  const dije = await prisma.etiquetaCatalogo.findFirstOrThrow({ where: { nombre: 'Dije bikini', activo: true } });
  if (dije.parte !== 'Bombacha') throw new Error(`El dije tiene parte=${dije.parte}, se esperaba Bombacha`);
  for (const sku of SKUS) {
    const o = await prisma.ordenProduccion.findUniqueOrThrow({ where: { sku }, include: { avios: { include: { etiqueta: true } } } });
    const ya = o.avios.some((a) => a.etiquetaId === dije.id);
    console.log(sku, o.estado, 'avíos:', o.avios.map((a) => `${a.etiqueta.nombre}×${a.cantidad}`).join(', ') || '—', ya ? '· ya tiene dije' : aplicar ? '· + dije' : '· (falta dije)');
    if (!ya && aplicar) await prisma.ordenAvio.create({ data: { ordenId: o.id, etiquetaId: dije.id, cantidad: 1, origen: 'corte' } });
  }
  if (aplicar) {
    const n = await prisma.ordenAvio.count({ where: { etiquetaId: dije.id, orden: { sku: { in: SKUS } } } });
    console.log(`releído: ${n} de ${SKUS.length} con dije`);
  }
}
main().finally(() => prisma.$disconnect());
