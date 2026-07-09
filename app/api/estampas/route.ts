import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

// Estampas DTF: la diseñadora carga con código interno; nombre comercial y producto
// son diferidos (no bloquean). Costo = precioMetroDtf × largoCm / 100.
const Schema = z.object({
  codigoInterno:   z.string().min(1, 'Poné un código interno'),
  nombreComercial: z.string().optional(),
  coleccion:       z.string().optional(),
  imagenUrl:       z.string().optional(),
  anchoCm:         z.number().min(0).optional(),
  largoCm:         z.number().min(0).optional(),
  mermaPercent:    z.number().min(0).optional(),
  ancho2Cm:        z.number().min(0).optional(),
  largo2Cm:        z.number().min(0).optional(),
  merma2Percent:   z.number().min(0).optional(),
  estado:          z.enum(['pensada', 'pedida', 'recibida']).optional(),
  sku:             z.string().optional(),
  notas:           z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await requirePermiso(req, 'estamperia');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const url = new URL(req.url);
  const estado = url.searchParams.get('estado');
  const q = url.searchParams.get('q')?.trim();
  const where: Record<string, unknown> = {};
  if (estado) where.estado = estado;
  if (q) where.OR = [
    { codigoInterno: { contains: q, mode: 'insensitive' } },
    { nombreComercial: { contains: q, mode: 'insensitive' } },
    { coleccion: { contains: q, mode: 'insensitive' } },
    { sku: { contains: q, mode: 'insensitive' } },
  ];

  const estampas = await prisma.estampa.findMany({ where, orderBy: { createdAt: 'desc' } });
  return NextResponse.json(estampas);
}

export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'estamperia');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  // Merma default de la config si no viene.
  const cfg = await prisma.configCostos.findUnique({ where: { id: 'singleton' }, select: { dtfMermaDefault: true } });
  const merma = d.mermaPercent ?? cfg?.dtfMermaDefault ?? 0;

  const estampa = await prisma.estampa.create({
    data: {
      codigoInterno:   d.codigoInterno.trim(),
      nombreComercial: d.nombreComercial?.trim() || null,
      coleccion:       d.coleccion?.trim() || null,
      imagenUrl:       d.imagenUrl?.trim() || null,
      anchoCm:         new Prisma.Decimal(d.anchoCm ?? 0),
      largoCm:         new Prisma.Decimal(d.largoCm ?? 0),
      mermaPercent:    new Prisma.Decimal(merma),
      ancho2Cm:        new Prisma.Decimal(d.ancho2Cm ?? 0),
      largo2Cm:        new Prisma.Decimal(d.largo2Cm ?? 0),
      merma2Percent:   new Prisma.Decimal(d.merma2Percent ?? 0),
      estado:          d.estado ?? 'pensada',
      sku:             d.sku?.trim() || null,
      notas:           d.notas?.trim() || null,
      creadoPor:       session.nombre,
    },
  });
  return NextResponse.json(estampa, { status: 201 });
}
