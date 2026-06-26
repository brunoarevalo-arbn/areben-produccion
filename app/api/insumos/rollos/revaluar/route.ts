import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireInsumos } from '@/lib/auth';
import { z } from 'zod';

const BodySchema = z.object({ tipoCambio: z.number().positive('TC inválido') });

// Revalúa el costo en pesos de los rollos/lotes en USD que todavía tienen stock
// (DISPONIBLE / EN_USO_PARCIAL): costo_pesos = costo_usd × TC. No toca el histórico
// (compras, escandallos guardados ni cortes ya registrados, que tienen su snapshot).
export async function POST(req: NextRequest) {
  const session = await requireInsumos(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const tc = new Prisma.Decimal(parsed.data.tipoCambio);

  const rollos = await prisma.rollo.findMany({
    where: { moneda: 'USD', costoUnitarioUsd: { not: null }, estado: { in: ['DISPONIBLE', 'EN_USO_PARCIAL'] } },
    select: { id: true, costoUnitarioUsd: true },
  });
  const lotes = await prisma.lote.findMany({
    where: { moneda: 'USD', costoUnitarioUsd: { not: null }, estado: { in: ['DISPONIBLE', 'EN_USO_PARCIAL'] } },
    select: { id: true, costoUnitarioUsd: true },
  });

  await prisma.$transaction([
    ...rollos.map((r) => prisma.rollo.update({ where: { id: r.id }, data: { costoUnitario: new Prisma.Decimal(r.costoUnitarioUsd!).mul(tc) } })),
    ...lotes.map((l) => prisma.lote.update({ where: { id: l.id }, data: { costoUnitario: new Prisma.Decimal(l.costoUnitarioUsd!).mul(tc) } })),
  ]);

  return NextResponse.json({ ok: true, rollos: rollos.length, lotes: lotes.length });
}
