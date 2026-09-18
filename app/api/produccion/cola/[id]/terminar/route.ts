import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { TerminarCosturaSchema } from '@/lib/validators/produccion';
import { terminarCosturaOrden, CosturaError } from '@/lib/produccion/costura';
import { LoteCorteError } from '@/lib/produccion/loteCorte';

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
    const total = await prisma.$transaction((tx) =>
      terminarCosturaOrden(tx, id, parsed.data.talles, session, parsed.data.permitirSinCosto));
    return NextResponse.json({ ok: true, total }, { status: 201 });
  } catch (e) {
    // `requiereAfirmar` le dice a la pantalla que esto NO es un error de carga: es un
    // freno que la persona puede levantar afirmando que entra sin costo. Va como flag y
    // no como texto para que la pantalla no tenga que adivinar matcheando el mensaje.
    if (e instanceof LoteCorteError) {
      return NextResponse.json({ error: e.message, requiereAfirmar: true }, { status: 400 });
    }
    if (e instanceof CosturaError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
