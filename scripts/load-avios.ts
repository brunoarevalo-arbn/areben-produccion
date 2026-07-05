import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL no está definida');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

type Avio = {
  nombre: string;
  categoria: string;
  tipo: string;
  unidad: string;
  marca: string;
  precio: number;
};

const AVIOS: Avio[] = [
  { nombre: 'Etiqueta Marca Stunned S', categoria: 'etiqueta', tipo: 'principal', unidad: 'etiqueta', marca: 'Stunned', precio: 77.04 },
  { nombre: 'Etiqueta Marca Stunned M', categoria: 'etiqueta', tipo: 'principal', unidad: 'etiqueta', marca: 'Stunned', precio: 77.04 },
  { nombre: 'Etiqueta Marca Stunned L', categoria: 'etiqueta', tipo: 'principal', unidad: 'etiqueta', marca: 'Stunned', precio: 77.04 },
  { nombre: 'Etiqueta Marca Stunned XL', categoria: 'etiqueta', tipo: 'principal', unidad: 'etiqueta', marca: 'Stunned', precio: 77.04 },
  { nombre: 'Badana Stunned 8x5.5', categoria: 'badana', tipo: 'otro', unidad: 'unidad', marca: 'Stunned', precio: 375.45 },
  { nombre: 'Badana PU Zattia Natural', categoria: 'badana', tipo: 'otro', unidad: 'unidad', marca: 'Zattia', precio: 134.40 },
  { nombre: 'Badana PU Zattia Negro', categoria: 'badana', tipo: 'otro', unidad: 'unidad', marca: 'Zattia', precio: 134.40 },
  { nombre: 'Badana PU Zattia Bordó', categoria: 'badana', tipo: 'otro', unidad: 'unidad', marca: 'Zattia', precio: 134.40 },
  { nombre: 'Etiqueta Satén Zattia 30x70mm S', categoria: 'etiqueta', tipo: 'otro', unidad: 'etiqueta', marca: 'Zattia', precio: 11.07 },
  { nombre: 'Etiqueta Satén Zattia 30x70mm M', categoria: 'etiqueta', tipo: 'otro', unidad: 'etiqueta', marca: 'Zattia', precio: 11.07 },
  { nombre: 'Etiqueta Satén Zattia 30x70mm L', categoria: 'etiqueta', tipo: 'otro', unidad: 'etiqueta', marca: 'Zattia', precio: 11.07 },
  { nombre: 'Etiqueta Composición Zattia 20x50mm', categoria: 'etiqueta', tipo: 'composicion', unidad: 'etiqueta', marca: 'Zattia', precio: 3.05 },
  { nombre: 'Etiqueta Marca Zattia 25x45mm', categoria: 'etiqueta', tipo: 'principal', unidad: 'etiqueta', marca: 'Zattia', precio: 19.81 },
  { nombre: 'Botón Zattia 20mm Oro italiano', categoria: 'boton', tipo: 'otro', unidad: 'unidad', marca: 'Zattia', precio: 131.00 },
  { nombre: 'Botón Zattia 20mm Black Níquel', categoria: 'boton', tipo: 'otro', unidad: 'unidad', marca: 'Zattia', precio: 131.00 },
];

async function main() {
  const existentes = new Set(
    (await prisma.etiquetaCatalogo.findMany({ select: { nombre: true } })).map((e) => e.nombre)
  );

  const nuevos = AVIOS.filter((a) => !existentes.has(a.nombre));
  const omitidos = AVIOS.filter((a) => existentes.has(a.nombre));

  if (omitidos.length) {
    console.log(`Omitidos por ya existir (${omitidos.length}):`);
    omitidos.forEach((a) => console.log(`  - ${a.nombre}`));
  }

  if (!nuevos.length) {
    console.log('No hay avíos nuevos para cargar.');
    return;
  }

  const res = await prisma.etiquetaCatalogo.createMany({
    data: nuevos.map((a) => ({ ...a, stock: null })),
    skipDuplicates: true,
  });

  console.log(`\nCreados ${res.count} avíos:`);
  nuevos.forEach((a) => console.log(`  + ${a.nombre}  ($${a.precio})`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
