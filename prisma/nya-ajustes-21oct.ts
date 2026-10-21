// NYA (cargada con cargar-nya-estampas-oct26.ts): lo que dijo Bruno el 21-oct.
//  1. FLOVIO (flores, 20 u) va ENTERA en el Lote 1 —«es lo mismo hacer todo en tema tiempo»—
//     ⇒ se deshace su Lote 2 (2·2·1) y vuelve al Lote 1.
//  2. Corte a $450/u en las 4 ⇒ validado, igual que validar-corte/route.ts.
//  3. Geometral por color desde bikinis-2027/img (NYA-1..4.png) → Blob → geometralUrl.
//
//   npx tsx --env-file=.env --env-file=<vercel env pull temporal> prisma/nya-ajustes-21oct.ts [--aplicar]
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { put } from '@vercel/blob';
import { deshacerLote, estadoDeLotes } from '../lib/produccion/lotesPlanificados';
import { cantidadCortada } from '../lib/produccion/cantidades';

const APLICAR = process.argv.includes('--aplicar');
const url = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const PRECIO_U = 450;
const COLORES: { sku: string; img: string }[] = [
  { sku: 'ZAT-BIK-FLOVIO-001', img: 'NYA-1' },
  { sku: 'ZAT-BIK-CUADAM-001', img: 'NYA-2' },
  { sku: 'ZAT-BIK-CUADRS-001', img: 'NYA-3' },
  { sku: 'ZAT-BIK-CUADRV-001', img: 'NYA-4' },
];

async function main() {
  console.log(`Base: ${url.replace(/:[^:@/]+@/, ':***@').replace(/\?.*/, '')}`);
  console.log(APLICAR ? '▶ APLICANDO' : '◻ SÓLO PLAN (agregá --aplicar para escribir)');
  if (APLICAR && !process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Falta BLOB_READ_WRITE_TOKEN');
  const bruno = await prisma.usuario.findFirst({ where: { email: 'brunoarevalo@arebensrl.com' } });
  if (!bruno) throw new Error('No encuentro el usuario de Bruno');

  const ops = await Promise.all(COLORES.map(async (c) => {
    const o = await prisma.ordenProduccion.findFirst({ where: { sku: c.sku } });
    if (!o) throw new Error(`No existe ${c.sku}`);
    if (o.corteEstado !== 'cargado') throw new Error(`${c.sku} está «${o.corteEstado}», no «cargado»`);
    const lotes = await estadoDeLotes(prisma as never, o);
    console.log(`  ${c.sku} cortadas ${cantidadCortada(o)} → corte $${PRECIO_U * cantidadCortada(o)} · geometral ${c.img}.png · lotes ${lotes.map((l) => l.numero).join(',')}`);
    return { ...c, o, imagen: readFileSync(`${homedir()}/Documents/bikinis-2027/img/${c.img}.png`) };
  }));
  if (!APLICAR) return;

  // Las imágenes primero: si falla una, la base queda intacta.
  const urls = new Map<string, string>();
  for (const c of ops) {
    const { url: u } = await put(`geometrales/bikinis-2027/${c.img}.png`, c.imagen, { access: 'public', addRandomSuffix: true, contentType: 'image/png' });
    urls.set(c.sku, u);
  }

  const session = { id: bruno.id, nombre: bruno.nombre, rol: 'admin', username: '' } as never;
  await prisma.$transaction(async (tx) => {
    await deshacerLote(tx, ops[0].o.id, 2, session);
    for (const c of ops) {
      const fd = { ...(c.o.fichaCorteData as Record<string, unknown>), costoCorte: PRECIO_U, modoCosto: 'unidad' };
      await tx.ordenProduccion.update({
        where: { id: c.o.id },
        data: {
          fichaCorteData: fd as Prisma.InputJsonValue,
          costoCorte: new Prisma.Decimal(PRECIO_U * cantidadCortada(c.o)),
          corteEstado: 'validado',
          geometralUrl: urls.get(c.sku)!,
        },
      });
    }
  }, { timeout: 60_000 });

  for (const c of ops) {
    const o = (await prisma.ordenProduccion.findFirst({ where: { sku: c.sku } }))!;
    const lotes = await estadoDeLotes(prisma as never, o);
    const r = await fetch(o.geometralUrl!, { method: 'HEAD' });
    console.log(`  ✅ ${c.sku} ${o.corteEstado} $${o.costoCorte} · geometral ${r.status} · ` +
      lotes.map((l) => `Lote ${l.numero}: ${l.talles.map((t) => `${t.talle}${t.cantidad}`).join(' ')}`).join(' · '));
  }
}

main().catch((e) => { console.error('❌', e.message ?? e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
