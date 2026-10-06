import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { SepararLoteSchema } from '@/lib/validators/produccion';
import {
  separarLote, deshacerLote, estadoDeLotes, lotesParaPantalla, activarSeparacion, ponerEnTaller, LotePlanificadoError,
} from '@/lib/produccion/lotesPlanificados';

type Ctx = { params: Promise<{ id: string }> };

// Los lotes planificados de una OP ("Lote 1 / Lote 2"): verlos, separar uno nuevo del
// Lote 1, o deshacer el último. Ver lib/produccion/lotesPlanificados.ts.
export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const orden = await prisma.ordenProduccion.findUnique({ where: { id }, select: { id: true, sku: true } });
  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });
  return NextResponse.json(lotesParaPantalla(await estadoDeLotes(prisma, orden)));
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const parsed = SepararLoteSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try {
    const lotes = await prisma.$transaction((tx) =>
      separarLote(tx, id, parsed.data.talles, parsed.data.despuesDe, session, parsed.data.programado));
    return NextResponse.json(lotesParaPantalla(lotes), { status: 201 });
  } catch (e) {
    if (e instanceof LotePlanificadoError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

const DeshacerSchema = z.object({ numero: z.number().int().min(2) });

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const parsed = DeshacerSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Indicá qué lote deshacer' }, { status: 400 });
  try {
    const lotes = await prisma.$transaction((tx) => deshacerLote(tx, id, parsed.data.numero, session));
    return NextResponse.json(lotesParaPantalla(lotes));
  } catch (e) {
    if (e instanceof LotePlanificadoError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

// Activar a mano una separación programada, o darle / sacarle un lote a la costurera.
const PatchSchema = z.union([
  z.object({ activar: z.literal(true) }),
  z.object({ numero: z.number().int().min(1), enTaller: z.boolean() }),
]);

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 });
  const d = parsed.data;
  try {
    const lotes = await prisma.$transaction((tx) => 'activar' in d
      ? activarSeparacion(tx, id, session, 'op')
      : ponerEnTaller(tx, id, d.numero, d.enTaller, session));
    return NextResponse.json(lotesParaPantalla(lotes));
  } catch (e) {
    if (e instanceof LotePlanificadoError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
