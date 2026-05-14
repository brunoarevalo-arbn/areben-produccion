// Uso: npx tsx prisma/seed-fase-catalogo.ts
// Carga valores iniciales del catálogo de fases. Idempotente — usa upsert por
// nombre, así correrlo varias veces no rompe nada.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL no está definida');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const FASES = [
  { nombre: 'Tela',           orden: 1 },
  { nombre: 'Ficha de corte', orden: 2 },
  { nombre: 'Corte',          orden: 3 },
  { nombre: 'Confección',     orden: 4 },
  { nombre: 'Lavadero',       orden: 5 },
  { nombre: 'Bordado',        orden: 6 },
  { nombre: 'Estampado',      orden: 7 },
];

async function main() {
  for (const f of FASES) {
    await prisma.faseCatalogo.upsert({
      where:  { nombre: f.nombre },
      create: { ...f, activo: true },
      update: { orden: f.orden },
    });
    console.log(`✓ ${f.orden}. ${f.nombre}`);
  }
  console.log(`\nCargadas ${FASES.length} fases.`);
}

main().finally(() => prisma.$disconnect());
