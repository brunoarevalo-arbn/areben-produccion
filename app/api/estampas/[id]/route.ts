import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

type Ctx = { params: Promise<{ id: string }> };

const Schema = z.object({
  codigoInterno:   z.string().min(1).optional(),
  nombreComercial: z.string().nullable().optional(),
  coleccion:       z.string().nullable().optional(),
  imagenUrl:       z.string().nullable().optional(),
  anchoCm:         z.number().min(0).optional(),
  largoCm:         z.number().min(0).optional(),
  mermaPercent:    z.number().min(0).optional(),
  estado:          z.enum(['pensada', 'pedida', 'recibida']).optional(),
  sku:             z.string().nullable().optional(),
  notas:           z.string().nullable().optional(),
});

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'estamperia');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  const data: Record<string, unknown> = {};
  if (d.codigoInterno !== undefined) data.codigoInterno = d.codigoInterno.trim();
  if (d.nombreComercial !== undefined) data.nombreComercial = d.nombreComercial?.trim() || null;
  if (d.coleccion !== undefined) data.coleccion = d.coleccion?.trim() || null;
  if (d.imagenUrl !== undefined) data.imagenUrl = d.imagenUrl?.trim() || null;
  if (d.anchoCm !== undefined) data.anchoCm = new Prisma.Decimal(d.anchoCm);
  if (d.largoCm !== undefined) data.largoCm = new Prisma.Decimal(d.largoCm);
  if (d.mermaPercent !== undefined) data.mermaPercent = new Prisma.Decimal(d.mermaPercent);
  if (d.estado !== undefined) data.estado = d.estado;
  if (d.sku !== undefined) data.sku = d.sku?.trim() || null;
  if (d.notas !== undefined) data.notas = d.notas?.trim() || null;

  const estampa = await prisma.estampa.update({ where: { id }, data });
  return NextResponse.json(estampa);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'estamperia');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  await prisma.estampa.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
