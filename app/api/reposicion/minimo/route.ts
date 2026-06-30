import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { z } from 'zod';

const MinimoSchema = z.object({
  gnId:   z.number().int(),
  talle:  z.string().min(1),
  minimo: z.number().int().min(0),
});

// Define el stock mínimo deseado de un estampado (producto GN) por talle → umbral de estampa.
export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'reposicion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const parsed = MinimoSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { gnId, talle, minimo } = parsed.data;
  const row = await prisma.reposicionMinimo.upsert({
    where:  { gnId_talle: { gnId, talle } },
    create: { gnId, talle, minimo },
    update: { minimo },
  });
  return NextResponse.json(row, { status: 201 });
}

// Quita el mínimo específico → ese producto+talle vuelve a usar el default.
export async function DELETE(req: NextRequest) {
  const session = await requirePermiso(req, 'reposicion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const url = new URL(req.url);
  const gnId = Number(url.searchParams.get('gnId'));
  const talle = url.searchParams.get('talle');
  if (!gnId || !talle) return NextResponse.json({ error: 'Falta gnId o talle' }, { status: 400 });
  await prisma.reposicionMinimo.deleteMany({ where: { gnId, talle } });
  return NextResponse.json({ deleted: true });
}
