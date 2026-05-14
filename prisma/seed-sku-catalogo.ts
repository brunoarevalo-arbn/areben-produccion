// Uso: npx tsx prisma/seed-sku-catalogo.ts
// Carga valores iniciales del catálogo de SKUs. Idempotente — usa upsert por
// (categoria, abreviatura), así correrlo varias veces no rompe nada.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL no está definida');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const ENTRIES: { categoria: 'marca' | 'prenda' | 'color'; nombre: string; abreviatura: string; orden: number }[] = [
  // Marcas
  { categoria: 'marca', nombre: 'Zattia',  abreviatura: 'ZAT', orden: 1 },
  { categoria: 'marca', nombre: 'Stunned', abreviatura: 'STU', orden: 2 },

  // Prendas
  { categoria: 'prenda', nombre: 'Remera',  abreviatura: 'REM', orden: 1 },
  { categoria: 'prenda', nombre: 'Campera', abreviatura: 'CAM', orden: 2 },
  { categoria: 'prenda', nombre: 'Buzo',    abreviatura: 'BUZ', orden: 3 },
  { categoria: 'prenda', nombre: 'Sweater', abreviatura: 'SWE', orden: 4 },
  { categoria: 'prenda', nombre: 'Top',     abreviatura: 'TOP', orden: 5 },
  { categoria: 'prenda', nombre: 'Body',    abreviatura: 'BOD', orden: 6 },

  // Colores básicos
  { categoria: 'color', nombre: 'Negro',    abreviatura: 'NEG', orden: 1 },
  { categoria: 'color', nombre: 'Blanco',   abreviatura: 'BLA', orden: 2 },
  { categoria: 'color', nombre: 'Gris',     abreviatura: 'GRI', orden: 3 },
  { categoria: 'color', nombre: 'Azul',     abreviatura: 'AZL', orden: 4 },
  { categoria: 'color', nombre: 'Rojo',     abreviatura: 'ROJ', orden: 5 },
  { categoria: 'color', nombre: 'Verde',    abreviatura: 'VER', orden: 6 },
  { categoria: 'color', nombre: 'Amarillo', abreviatura: 'AMA', orden: 7 },
  { categoria: 'color', nombre: 'Beige',    abreviatura: 'BEI', orden: 8 },
  { categoria: 'color', nombre: 'Marrón',   abreviatura: 'MAR', orden: 9 },
  { categoria: 'color', nombre: 'Rosa',     abreviatura: 'ROS', orden: 10 },
];

async function main() {
  for (const e of ENTRIES) {
    await prisma.skuCatalogo.upsert({
      where:  { categoria_abreviatura: { categoria: e.categoria, abreviatura: e.abreviatura } },
      create: { ...e, activo: true },
      update: { nombre: e.nombre, orden: e.orden },
    });
    console.log(`✓ ${e.categoria.padEnd(7)} ${e.abreviatura} (${e.nombre})`);
  }
  console.log(`\nCargados ${ENTRIES.length} entries.`);
}

main().finally(() => prisma.$disconnect());
