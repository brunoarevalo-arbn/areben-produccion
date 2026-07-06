import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { z } from 'zod';

const BodySchema = z.object({
  ordenIds: z.array(z.string().min(1)).min(2, 'Elegí al menos 2 órdenes'),
  // prenda (abreviatura del molde) opcional; si no viene se deriva del SKU.
  prenda:   z.string().optional(),
});

// Agrupa OPs sueltas existentes (mismo molde, distintos colores) en un LoteProduccion
// madre, para que usen el flujo agrupado (Cortar lote / Terminar lote). Solo activas y
// sin lote previo; deben compartir marca. No toca cortes ni stock: solo el vínculo.
export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const ordenes = await prisma.ordenProduccion.findMany({
    where: { id: { in: parsed.data.ordenIds } },
    select: { id: true, sku: true, marca: true, descripcion: true, loteId: true, estado: true },
  });
  if (ordenes.length !== parsed.data.ordenIds.length) {
    return NextResponse.json({ error: 'Alguna OP no existe' }, { status: 400 });
  }
  if (ordenes.some((o) => o.estado === 'CERRADA')) {
    return NextResponse.json({ error: 'No se pueden agrupar OPs cerradas' }, { status: 400 });
  }
  // Se permiten OPs sueltas o SOLAS en su lote. Si alguna está en un lote con varios
  // colores, no se mueve (no desarmamos lotes ya armados).
  const sourceLoteIds = [...new Set(ordenes.map((o) => o.loteId).filter(Boolean))] as string[];
  if (sourceLoteIds.length) {
    const counts = await prisma.ordenProduccion.groupBy({
      by: ['loteId'], where: { loteId: { in: sourceLoteIds } }, _count: { _all: true },
    });
    if (counts.some((c) => c._count._all > 1)) {
      return NextResponse.json({ error: 'Alguna OP está en un lote con varios colores; no se puede mover sin desarmarlo.' }, { status: 400 });
    }
  }
  const marcas = new Set(ordenes.map((o) => o.marca));
  if (marcas.size > 1) {
    return NextResponse.json({ error: 'Las órdenes deben ser de la misma marca' }, { status: 400 });
  }

  const marca = ordenes[0].marca;
  // prenda = 2do segmento del SKU (MARCA-PRENDA-COLOR-####); usa la primera disponible.
  const prenda = parsed.data.prenda
    || ordenes.map((o) => (o.sku || '').split('-')[1]).find(Boolean)
    || null;

  const result = await prisma.$transaction(async (tx) => {
    const lote = await tx.loteProduccion.create({
      data: { marca, prenda, creadoPor: session.nombre },
    });
    await tx.ordenProduccion.updateMany({
      where: { id: { in: parsed.data.ordenIds } },
      data: { loteId: lote.id },
    });
    // Los lotes de origen (cada uno tenía 1 sola OP, ya movida) quedan vacíos → se borran.
    if (sourceLoteIds.length) {
      await tx.loteProduccion.deleteMany({ where: { id: { in: sourceLoteIds } } });
    }
    return lote;
  });

  return NextResponse.json(result, { status: 201 });
}
