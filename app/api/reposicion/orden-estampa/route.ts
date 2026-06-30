import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { z } from 'zod';

const BodySchema = z.object({
  notas: z.string().optional(),
  items: z.array(z.object({
    gnId:     z.number().int(),
    gnNombre: z.string().optional(),
    skuLiso:  z.string().min(1),
    talle:    z.string().min(1),
    cantidad: z.number().int().positive(),
  })).min(1, 'No hay nada para estampar'),
});

export async function GET(req: NextRequest) {
  const session = await requirePermiso(req, 'reposicion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const ordenes = await prisma.ordenEstampa.findMany({
    orderBy: { creadoAt: 'desc' },
    take: 50,
    include: { items: { orderBy: [{ skuLiso: 'asc' }, { gnNombre: 'asc' }, { talle: 'asc' }] } },
  });
  return NextResponse.json(ordenes);
}

export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'reposicion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const orden = await prisma.ordenEstampa.create({
    data: {
      creadoPor: session.nombre,
      notas: parsed.data.notas?.trim() || null,
      items: { create: parsed.data.items.map((i) => ({ gnId: i.gnId, gnNombre: i.gnNombre || null, skuLiso: i.skuLiso, talle: i.talle, cantidad: i.cantidad })) },
    },
    include: { items: true },
  });
  return NextResponse.json(orden, { status: 201 });
}
