import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { z } from 'zod';

// Edición masiva de tamaños (ancho/largo) de estampas.
const Schema = z.object({
  cambios: z.array(z.object({
    id: z.string().min(1),
    anchoCm: z.number().min(0),
    largoCm: z.number().min(0),
    ancho2Cm: z.number().min(0).optional(),
    largo2Cm: z.number().min(0).optional(),
  })).min(1, 'No hay cambios'),
});

export async function PATCH(req: NextRequest) {
  const session = await requirePermiso(req, 'estamperia');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { cambios } = parsed.data;
  await prisma.$transaction(
    cambios.map((c) => prisma.estampa.update({
      where: { id: c.id },
      data: {
        anchoCm: new Prisma.Decimal(c.anchoCm), largoCm: new Prisma.Decimal(c.largoCm),
        ...(c.ancho2Cm !== undefined ? { ancho2Cm: new Prisma.Decimal(c.ancho2Cm) } : {}),
        ...(c.largo2Cm !== undefined ? { largo2Cm: new Prisma.Decimal(c.largo2Cm) } : {}),
      },
    })),
  );

  return NextResponse.json({ actualizadas: cambios.length });
}
