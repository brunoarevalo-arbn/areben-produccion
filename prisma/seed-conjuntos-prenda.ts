// Siembra el catálogo de prendas que se COSEN por partes.
//
// Hoy es una sola fila: la bikini (BIK) = Corpiño + Bombacha. Se corta junta —una
// tizada, entran 6 en un espacio— pero se cose y se vende por pieza, así que sus
// minutos tienen que quedar separados desde el primer registro.
//
// 🔑 La clave es el 2º segmento del SKU, no el nombre: `ZAT-BIK-VER-001` → "BIK".
// Ver `lib/produccion/conjuntos.ts`, que es el único que lee esa posición.
//
// Cada parte lleva su `skuAbrev`: el 2º segmento del SKU con el que esa pieza ingresa a
// stock (`ZAT-BIK-VER-001` → `ZAT-COR-VER-001`). Sin eso la pieza no tiene a qué código
// entrar y el ingreso se planta.
//
// ⚠️ El `porcentajeMaterial` —qué parte del material se lleva cada pieza— NO se siembra
// acá con un número inventado: no hay dato medido (la bikini es UN molde en
// `molderia_catalogo`) y un 50/50 puesto por el script se lee después como si alguien lo
// hubiera medido. Se pasa a mano cuando se sepa, y hasta entonces el ingreso se planta
// SÓLO si hay material que repartir:
//
//   npx tsx prisma/seed-conjuntos-prenda.ts            # dry-run (default)
//   npx tsx prisma/seed-conjuntos-prenda.ts --aplicar
//   npx tsx prisma/seed-conjuntos-prenda.ts --aplicar --porcentajes BIK=40/60
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
const APLICAR = process.argv.includes('--aplicar');

const CONJUNTOS: { prendaAbrev: string; nombre: string; partes: { nombre: string; skuAbrev: string }[] }[] = [
  { prendaAbrev: 'BIK', nombre: 'Bikini', partes: [
    { nombre: 'Corpiño',  skuAbrev: 'COR' },
    { nombre: 'Bombacha', skuAbrev: 'BOM' },
  ] },
];

/** `--porcentajes BIK=40/60` → { BIK: [40, 60] }, en el orden de las partes. */
function porcentajesPedidos(): Map<string, number[]> {
  const i = process.argv.indexOf('--porcentajes');
  if (i === -1) return new Map();
  return new Map((process.argv[i + 1] ?? '').split(',').filter(Boolean).map((par) => {
    const [abrev, valores] = par.split('=');
    return [abrev.trim().toUpperCase(), (valores ?? '').split('/').map((n) => Number(n))] as [string, number[]];
  }));
}

async function main() {
  console.log(APLICAR ? '— APLICANDO —\n' : '— DRY RUN (agregá --aplicar para escribir) —\n');
  const porcentajes = porcentajesPedidos();

  for (const c of CONJUNTOS) {
    const existente = await prisma.conjuntoPrenda.findUnique({
      where: { prendaAbrev: c.prendaAbrev },
      include: { partes: { orderBy: { orden: 'asc' } } },
    });

    const pct = porcentajes.get(c.prendaAbrev);
    if (pct && pct.length !== c.partes.length) {
      throw new Error(`--porcentajes ${c.prendaAbrev}: ${pct.length} valores para ${c.partes.length} partes`);
    }
    if (pct && Math.abs(pct.reduce((s, n) => s + n, 0) - 100) > 0.01) {
      throw new Error(`--porcentajes ${c.prendaAbrev}: suman ${pct.reduce((s, n) => s + n, 0)}%, no 100%`);
    }

    if (existente) {
      // El NOMBRE de una parte no se pisa: los registros viejos de la tablet lo dicen
      // tal cual, y reescribirlo dejaría minutos huérfanos apuntando a algo que ya no
      // existe en el catálogo. Lo que sí se completa es lo que está en NULL, que es un
      // dato que falta y no una decisión de alguien.
      console.log(
        `= ${c.prendaAbrev} ya existe (${existente.nombre}: ${existente.partes.map((p) => p.nombre).join(' · ') || 'SIN PARTES'})`,
      );
      for (const [i, p] of existente.partes.entries()) {
        const deseada = c.partes.find((x) => x.nombre === p.nombre);
        const datos: { skuAbrev?: string; porcentajeMaterial?: number } = {};
        if (!p.skuAbrev && deseada) datos.skuAbrev = deseada.skuAbrev;
        if (pct) datos.porcentajeMaterial = pct[i];
        if (Object.keys(datos).length === 0) { console.log(`    = ${p.nombre}: sin cambios`); continue; }
        console.log(`    ~ ${p.nombre}: ${JSON.stringify(datos)}`);
        if (APLICAR) await prisma.partePrenda.update({ where: { id: p.id }, data: datos });
      }
      continue;
    }

    console.log(`+ ${c.prendaAbrev} — ${c.nombre}: ${c.partes.map((p) => `${p.nombre} (${p.skuAbrev})`).join(' · ')}`);
    if (!APLICAR) continue;

    await prisma.conjuntoPrenda.create({
      data: {
        prendaAbrev: c.prendaAbrev,
        nombre: c.nombre,
        partes: { create: c.partes.map((p, i) => ({
          orden: i + 1, nombre: p.nombre, skuAbrev: p.skuAbrev,
          porcentajeMaterial: pct ? pct[i] : null,
        })) },
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
