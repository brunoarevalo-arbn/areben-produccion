import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

// Carga masiva de estampas: varias filas de una (solo el código es obligatorio).
const Schema = z.object({
  filas: z.array(z.object({
    codigoInterno:   z.string().min(1),
    nombreComercial: z.string().optional(),
    coleccion:       z.string().optional(),
    anchoCm:         z.number().min(0).optional(),
    largoCm:         z.number().min(0).optional(),
  })).min(1, 'Cargá al menos una fila'),
});

export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'estamperia');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const cfg = await prisma.configCostos.findUnique({ where: { id: 'singleton' }, select: { dtfMermaDefault: true } });
  const merma = new Prisma.Decimal(cfg?.dtfMermaDefault ?? 0);

  const res = await prisma.estampa.createMany({
    data: parsed.data.filas.map((f) => ({
      codigoInterno:   f.codigoInterno.trim(),
      nombreComercial: f.nombreComercial?.trim() || null,
      coleccion:       f.coleccion?.trim() || null,
      anchoCm:         new Prisma.Decimal(f.anchoCm ?? 0),
      largoCm:         new Prisma.Decimal(f.largoCm ?? 0),
      mermaPercent:    merma,
      creadoPor:       session.nombre,
    })),
  });
  return NextResponse.json({ creadas: res.count }, { status: 201 });
}
