// Siembra el catálogo de prendas que se COSEN por partes.
//
// Hoy es una sola fila: la bikini (BIK) = Corpiño + Bombacha. Se corta junta —una
// tizada, entran 6 en un espacio— pero se cose y se vende por pieza, así que sus
// minutos tienen que quedar separados desde el primer registro.
//
// 🔑 La clave es el 2º segmento del SKU, no el nombre: `ZAT-BIK-VER-001` → "BIK".
// Ver `lib/produccion/conjuntos.ts`, que es el único que lee esa posición.
//
//   npx tsx prisma/seed-conjuntos-prenda.ts            # dry-run (default)
//   npx tsx prisma/seed-conjuntos-prenda.ts --aplicar
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
const APLICAR = process.argv.includes('--aplicar');

const CONJUNTOS: { prendaAbrev: string; nombre: string; partes: string[] }[] = [
  { prendaAbrev: 'BIK', nombre: 'Bikini', partes: ['Corpiño', 'Bombacha'] },
];

async function main() {
  console.log(APLICAR ? '— APLICANDO —\n' : '— DRY RUN (agregá --aplicar para escribir) —\n');

  for (const c of CONJUNTOS) {
    const existente = await prisma.conjuntoPrenda.findUnique({
      where: { prendaAbrev: c.prendaAbrev },
      include: { partes: { orderBy: { orden: 'asc' } } },
    });

    if (existente) {
      // No se pisa: si alguien renombró una parte, los registros viejos dicen ese
      // nombre y reescribirlo dejaría minutos huérfanos apuntando a algo que ya no
      // existe en el catálogo.
      console.log(
        `= ${c.prendaAbrev} ya existe (${existente.nombre}: ${existente.partes.map((p) => p.nombre).join(' · ') || 'SIN PARTES'}) — no se toca`,
      );
      continue;
    }

    console.log(`+ ${c.prendaAbrev} — ${c.nombre}: ${c.partes.join(' · ')}`);
    if (!APLICAR) continue;

    await prisma.conjuntoPrenda.create({
      data: {
        prendaAbrev: c.prendaAbrev,
        nombre: c.nombre,
        partes: { create: c.partes.map((nombre, i) => ({ orden: i + 1, nombre })) },
      },
    });
  }

  // Qué órdenes en costura quedarían con selector, para verlo antes de escribir.
  const ordenes = await prisma.ordenProduccion.findMany({
    where: { estado: 'COSTURA' },
    select: { sku: true, descripcion: true },
  });
  const abrevs = new Set(CONJUNTOS.map((c) => c.prendaAbrev));
  const alcanzadas = ordenes.filter((o) => {
    const partes = (o.sku ?? '').split('-');
    return partes.length >= 3 && abrevs.has(partes[1]?.trim().toUpperCase());
  });

  console.log(`\nÓrdenes en COSTURA: ${ordenes.length} · con selector de parte: ${alcanzadas.length}`);
  for (const o of alcanzadas) console.log(`  · ${o.sku} — ${o.descripcion ?? ''}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
