// Uso: npx tsx prisma/migrate-permisos-denylist.ts
// Invierte el array `permisos` de cada usuario no admin/no costurera:
// antes era allowlist (lo que veían), ahora es denylist (lo que NO ven).

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ALL_PERMISOS = ['dashboard', 'diseno', 'produccion', 'gastos', 'costos', 'configuracion'];

async function main() {
  const usuarios = await prisma.usuario.findMany({
    where: { rol: { notIn: ['admin', 'costurera'] } },
    select: { id: true, nombre: true, rol: true, permisos: true },
  });

  console.log(`Encontrados ${usuarios.length} usuarios para migrar.\n`);

  for (const u of usuarios) {
    const nuevos = ALL_PERMISOS.filter((s) => !u.permisos.includes(s));
    console.log(`- ${u.nombre} (${u.rol})`);
    console.log(`    antes (permitidas): ${JSON.stringify(u.permisos)}`);
    console.log(`    ahora (bloqueadas): ${JSON.stringify(nuevos)}`);
    await prisma.usuario.update({ where: { id: u.id }, data: { permisos: nuevos } });
  }

  console.log('\nListo.');
}

main().finally(() => prisma.$disconnect());
