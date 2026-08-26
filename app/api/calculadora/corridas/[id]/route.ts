import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { cargarCorrida, serializar } from '@/lib/calculadora/corridaDb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requirePermiso(req, 'calculadora'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const c = await cargarCorrida(id);
  if (!c) return NextResponse.json({ error: 'No existe' }, { status: 404 });
  return NextResponse.json(serializar(c));
}

const PatchSchema = z.object({
  estado: z.enum(['pendiente', 'en_curso', 'terminada', 'anulada']).optional(),
  escandalloId: z.string().trim().nullable().optional(),
  notas: z.string().trim().max(500).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requirePermiso(req, 'calculadora'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  await prisma.corridaMuestra.update({
    where: { id },
    data: {
      ...(parsed.data.estado ? { estado: parsed.data.estado, ...(parsed.data.estado === 'terminada' ? { terminadaAt: new Date() } : {}) } : {}),
      ...(parsed.data.escandalloId !== undefined ? { escandalloId: parsed.data.escandalloId || null } : {}),
      ...(parsed.data.notas !== undefined ? { notas: parsed.data.notas || null } : {}),
    },
  });

  const c = await cargarCorrida(id);
  return NextResponse.json(serializar(c!));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requirePermiso(req, 'calculadora'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  // Cascada: pasos, mediciones y ribetes se van con la corrida.
  await prisma.corridaMuestra.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
