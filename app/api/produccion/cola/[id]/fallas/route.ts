import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { PROCESOS_DE_FALLA } from '@/lib/constants/lotes';
import { registrarFalla, borrarFalla, lotesParaPantalla, LotePlanificadoError } from '@/lib/produccion/lotesPlanificados';

type Ctx = { params: Promise<{ id: string }> };

// Fallas de un lote planificado: piezas perdidas en un proceso, que el lote deja de
// esperar. Ver lib/produccion/lotesPlanificados.ts.
const FallaSchema = z.object({
  numero:   z.number().int().min(1),
  parte:    z.string().min(1).max(40).nullable(),
  talle:    z.string().min(1).max(10),
  cantidad: z.number().int().positive('La cantidad tiene que ser mayor a 0'),
  proceso:  z.enum(PROCESOS_DE_FALLA),
  motivo:   z.string().max(200).nullable().optional(),
});

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const parsed = FallaSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try {
    const lotes = await prisma.$transaction((tx) => registrarFalla(tx, id, parsed.data, session));
    return NextResponse.json(lotesParaPantalla(lotes), { status: 201 });
  } catch (e) {
    if (e instanceof LotePlanificadoError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

const BorrarSchema = z.object({ fallaId: z.string().min(1) });

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const parsed = BorrarSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Indicá qué falla borrar' }, { status: 400 });
  try {
    const lotes = await prisma.$transaction((tx) => borrarFalla(tx, id, parsed.data.fallaId, session));
    return NextResponse.json(lotesParaPantalla(lotes));
  } catch (e) {
    if (e instanceof LotePlanificadoError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
