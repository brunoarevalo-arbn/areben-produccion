import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { MARCAS } from '@/lib/marcas';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

// Carga masiva de estampas: varias filas de una (solo el código es obligatorio).
const Schema = z.object({
  filas: z.array(z.object({
    codigoInterno:   z.string().min(1),
    nombreComercial: z.string().optional(),
    coleccion:       z.string().optional(),
    marca:           z.enum(MARCAS).optional(),
    imagenUrl:       z.string().max(2048).optional(),
    anchoCm:         z.number().min(0).optional(),
    largoCm:         z.number().min(0).optional(),
    ancho2Cm:        z.number().min(0).optional(),
    largo2Cm:        z.number().min(0).optional(),
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
    data: parsed.data.filas.map((f) => {
      // Mismo criterio que el resto del módulo: hay 2º tamaño si ancho2 Y largo2 son > 0.
      // Si lo hay, lleva la MISMA merma default que el 1º (si no, saldría más barato sin motivo).
      const tiene2 = (f.ancho2Cm ?? 0) > 0 && (f.largo2Cm ?? 0) > 0;
      return {
        codigoInterno:   f.codigoInterno.trim(),
        nombreComercial: f.nombreComercial?.trim() || null,
        coleccion:       f.coleccion?.trim() || null,
        marca:           f.marca ?? null,
        imagenUrl:       f.imagenUrl?.trim() || null,
        anchoCm:         new Prisma.Decimal(f.anchoCm ?? 0),
        largoCm:         new Prisma.Decimal(f.largoCm ?? 0),
        mermaPercent:    merma,
        ancho2Cm:        new Prisma.Decimal(f.ancho2Cm ?? 0),
        largo2Cm:        new Prisma.Decimal(f.largo2Cm ?? 0),
        merma2Percent:   tiene2 ? merma : new Prisma.Decimal(0),
        creadoPor:       session.nombre,
      };
    }),
  });
  return NextResponse.json({ creadas: res.count }, { status: 201 });
}
