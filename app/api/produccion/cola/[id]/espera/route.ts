import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

// Poner una orden EN ESPERA ("falta dije"): sale de la tablet hasta que alguien la retoma.
// ⛔ No mueve el estado ni el stock: es una marca, y queda en el historial de la OP.
const EsperaSchema = z.object({ motivo: z.string().trim().min(1, 'Decí qué falta').max(120) });

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const parsed = EsperaSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const orden = await prisma.ordenProduccion.findUnique({ where: { id } });
  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });
  if (orden.estado === 'CERRADA') return NextResponse.json({ error: 'La orden ya está cerrada' }, { status: 400 });

  await prisma.$transaction([
    prisma.ordenProduccion.update({
      where: { id },
      data: { enEsperaDesde: new Date(), enEsperaMotivo: parsed.data.motivo, enEsperaPor: session.nombre },
    }),
    prisma.estadoTransicion.create({
      data: {
        ordenId: id, estadoAnterior: orden.estado, estadoNuevo: orden.estado, usuarioId: session.id,
        notas: `En espera: ${parsed.data.motivo}. Sale de la tablet hasta que se retome.`,
      },
    }),
  ]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const orden = await prisma.ordenProduccion.findUnique({ where: { id } });
  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });
  if (!orden.enEsperaDesde) return NextResponse.json({ error: 'La orden no está en espera' }, { status: 400 });

  await prisma.$transaction([
    prisma.ordenProduccion.update({ where: { id }, data: { enEsperaDesde: null, enEsperaMotivo: null, enEsperaPor: null } }),
    prisma.estadoTransicion.create({
      data: {
        ordenId: id, estadoAnterior: orden.estado, estadoNuevo: orden.estado, usuarioId: session.id,
        notas: `Retomada (estaba en espera: ${orden.enEsperaMotivo ?? '—'}). Vuelve a la tablet.`,
      },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
