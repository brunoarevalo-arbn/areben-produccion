import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { z } from 'zod';

type Ctx = { params: Promise<{ id: string }> };

const BodySchema = z.object({
  marca:  z.string().min(1).optional(),
  prenda: z.string().min(1),
  color:  z.string().min(1),
});

const PAD = 3;

// Genera y asigna el SKU de una OP a partir de marca + prenda + color (abreviaturas
// del catálogo). Se usa al mandar a costura, cuando la OP todavía no tiene SKU.
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const orden = await prisma.ordenProduccion.findUnique({ where: { id } });
  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });

  const marca = (parsed.data.marca || orden.marca || '').trim();
  const prefijo = `${marca}-${parsed.data.prenda}-${parsed.data.color}-`.toUpperCase();

  const existentes = await prisma.ordenProduccion.findMany({
    where:  { sku: { startsWith: prefijo } },
    select: { sku: true },
  });
  let maxN = 0;
  for (const { sku } of existentes) {
    if (!sku) continue;
    const n = parseInt(sku.slice(prefijo.length), 10);
    if (!isNaN(n) && n > maxN) maxN = n;
  }
  const numero = maxN + 1;
  const sku = prefijo + String(numero).padStart(Math.max(PAD, String(numero).length), '0');

  const updated = await prisma.ordenProduccion.update({
    where: { id },
    data: { sku, marca: marca || orden.marca },
  });
  return NextResponse.json(updated);
}
