import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { TerminarLoteSchema } from '@/lib/validators/produccion';
import { terminarCosturaOrden, CosturaError } from '@/lib/produccion/costura';

type Ctx = { params: Promise<{ loteId: string }> };

// Termina la costura de varios colores de un lote en una sola transacción. Parcial:
// solo se mandan los colores cargados (con al menos un talle > 0); el resto sigue en COSTURA.
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { loteId } = await params;
  const parsed = TerminarLoteSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  // Solo colores con conteo real (>0). Permite mandar el form con campos en cero.
  const colores = parsed.data.colores
    .map((c) => ({ ordenId: c.ordenId, talles: c.talles.filter((t) => t.cantidad > 0) }))
    .filter((c) => c.talles.length > 0);
  if (colores.length === 0) {
    return NextResponse.json({ error: 'Cargá la cantidad que salió de al menos un color' }, { status: 400 });
  }

  // Validar que las OPs pertenezcan al lote.
  const ordenIds = colores.map((c) => c.ordenId);
  if (new Set(ordenIds).size !== ordenIds.length) {
    return NextResponse.json({ error: 'Hay colores repetidos' }, { status: 400 });
  }
  const ordenes = await prisma.ordenProduccion.findMany({
    where: { id: { in: ordenIds } },
    select: { id: true, loteId: true, sku: true },
  });
  const ordenMap = new Map(ordenes.map((o) => [o.id, o]));
  for (const c of colores) {
    const o = ordenMap.get(c.ordenId);
    if (!o) return NextResponse.json({ error: `OP ${c.ordenId} no encontrada` }, { status: 400 });
    if (o.loteId !== loteId) return NextResponse.json({ error: `La OP ${o.sku ?? c.ordenId} no pertenece a este lote` }, { status: 400 });
  }

  try {
    const total = await prisma.$transaction(async (tx) => {
      let acum = 0;
      for (const c of colores) acum += await terminarCosturaOrden(tx, c.ordenId, c.talles, session);
      return acum;
    });
    return NextResponse.json({ ok: true, colores: colores.length, total }, { status: 201 });
  } catch (e) {
    if (e instanceof CosturaError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
