import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

// Muestra cargada por el cortador: consumo de la tizada de muestra + su valor (cobrable).
const Schema = z.object({
  descripcion: z.string().min(1, 'Poné una descripción'),
  consumo: z.number().min(0).default(0),
  unidad: z.enum(['m', 'kg']).default('m'),
  valor: z.number().min(0).default(0),
  fecha: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'cortador');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const cortador = await prisma.cortador.findFirst({ where: { usuarioId: session.id } });
  if (!cortador) return NextResponse.json({ error: 'Tu usuario no está vinculado a un cortador' }, { status: 400 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { descripcion, consumo, unidad, valor, fecha } = parsed.data;

  const muestra = await prisma.corteMuestra.create({
    data: {
      cortadorId: cortador.id,
      descripcion: descripcion.trim(),
      consumo: new Prisma.Decimal(consumo),
      unidad,
      valor: new Prisma.Decimal(valor),
      fecha: fecha ? new Date(`${fecha}T12:00:00Z`) : new Date(),
    },
  });
  return NextResponse.json(muestra, { status: 201 });
}
