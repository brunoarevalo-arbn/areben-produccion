import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { siguienteNumeroSku, formatSku } from '@/lib/produccion/sku';
import { retryOnUniqueConflict } from '@/lib/db/retry';
import { z } from 'zod';

type Ctx = { params: Promise<{ id: string }> };

const BodySchema = z.object({
  marca:  z.string().min(1).optional(),
  prenda: z.string().min(1),
  color:  z.string().min(1),
});

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

  // Genera el número leyendo el máximo del prefijo; si dos requests chocan contra el
  // índice único de sku, reintenta regenerando (sin locks).
  const updated = await retryOnUniqueConflict(async () => {
    const numero = await siguienteNumeroSku(prisma, prefijo);
    const sku = formatSku(prefijo, numero);
    return prisma.ordenProduccion.update({
      where: { id },
      data: { sku, marca: marca || orden.marca },
    });
  });
  return NextResponse.json(updated);
}
