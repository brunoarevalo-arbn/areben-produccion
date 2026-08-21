// Backfill del DUEÑO de cada pago: `pagos_cortes.cortadorId`.
//
// Hasta ahora un pago imputado no necesitaba dueño propio: se ataba al cortador por sus
// ítems, y la cuenta sólo restaba los pagos SIN ítems (los "a cuenta"). Con la cuenta
// corriente —todos los cortes menos todos los pagos— la cuenta se arma por `cortadorId`,
// así que un pago sin dueño **desaparece de la cuenta**: son $127.200 que dejarían el
// saldo de Fernando en +13.500 en vez de −113.700.
//
// 🔴 Por eso esto va ANTES de deployar la fórmula nueva. Correrlo contra el código viejo
//    es inocuo: poner `cortadorId` en un pago que TIENE ítems no lo convierte en "a
//    cuenta" (ese término exige `ordenes: { none: {} }`), así que el saldo de hoy no se
//    mueve ni un peso.
//
// Idempotente: asigna sólo donde el dueño es inequívoco (todos los ítems del pago son de
// un mismo cortador). Cero ítems o dos cortadores distintos → lo reporta y no lo toca.
//
//   npx tsx prisma/migrate-pago-cortador-ago26.ts            → sólo informa (dry run)
//   npx tsx prisma/migrate-pago-cortador-ago26.ts --aplicar  → escribe
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
const APLICAR = process.argv.includes('--aplicar');
const $ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

async function main() {
  const sinDuenio = await prisma.pagoCorte.findMany({
    where: { cortadorId: null },
    select: {
      id: true, fecha: true, beneficiario: true, montoTotal: true,
      ordenes: { select: { cortadorId: true } },
      muestras: { select: { cortadorId: true } },
    },
    orderBy: { fecha: 'asc' },
  });

  console.log(`${sinDuenio.length} pago(s) sin cortador`);
  if (sinDuenio.length === 0) { console.log('✓ nada que hacer'); return; }

  const resueltos: { id: string; cortadorId: string; etiqueta: string }[] = [];
  const ambiguos: string[] = [];

  for (const p of sinDuenio) {
    const ids = [...new Set([...p.ordenes, ...p.muestras].map((i) => i.cortadorId).filter(Boolean) as string[])];
    const etiqueta = `${p.fecha.toISOString().slice(0, 10)} · ${p.beneficiario} · ${$(Number(p.montoTotal))} · ${p.ordenes.length} corte(s)`;
    if (ids.length === 1) resueltos.push({ id: p.id, cortadorId: ids[0], etiqueta });
    else ambiguos.push(`${etiqueta} → ${ids.length === 0 ? 'sin ítems: no hay de dónde deducirlo' : `${ids.length} cortadores distintos`}`);
  }

  const nombres = new Map((await prisma.cortador.findMany({ select: { id: true, nombre: true } })).map((c) => [c.id, c.nombre]));
  for (const r of resueltos) console.log(`   ✓ ${r.etiqueta} → ${nombres.get(r.cortadorId) ?? r.cortadorId}`);
  for (const a of ambiguos) console.log(`   ⚠ ${a}`);

  if (!APLICAR) { console.log('\n(dry run — no se escribió nada; correr con --aplicar)'); return; }

  for (const r of resueltos) await prisma.pagoCorte.update({ where: { id: r.id }, data: { cortadorId: r.cortadorId } });
  console.log(`\nAsignados: ${resueltos.length}. Sin resolver: ${ambiguos.length}.`);
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
