import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { TerminarCosturaSchema } from '@/lib/validators/produccion';
import { terminarCosturaOrden, CosturaError } from '@/lib/produccion/costura';

type Ctx = { params: Promise<{ id: string }> };

// Termina la costura: se cuenta lo que salió por talle y eso ingresa al stock de
// lisos terminados (por SKU + talle). La OP pasa a TERMINADO_SIN_ESTAMPA.
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const parsed = TerminarCosturaSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    const total = await prisma.$transaction((tx) => terminarCosturaOrden(tx, id, parsed.data.talles, session));
    return NextResponse.json({ ok: true, total }, { status: 201 });
  } catch (e) {
    if (e instanceof CosturaError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
