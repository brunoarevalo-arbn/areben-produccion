import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { z } from 'zod';

// Edición masiva de los tiempos de estampería (minutos por estampa) de los
// productos con estampa. Cada cambio manda el array completo de estampas del
// producto con los minutos ya actualizados.
const Schema = z.object({
  cambios: z.array(z.object({
    id: z.string().min(1),
    estampas: z.array(z.object({
      estampaId:        z.string().min(1),
      tamano:           z.number().optional(),
      minutosEstampado: z.number().min(0).optional(),
    })),
  })).min(1, 'No hay cambios'),
});

export async function PATCH(req: NextRequest) {
  if (!(await requirePermiso(req, 'costos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { cambios } = parsed.data;
  await prisma.$transaction(
    cambios.map((c) => prisma.productoEstampado.update({
      where: { id: c.id },
      data: { estampas: c.estampas.map((e) => ({ estampaId: e.estampaId, tamano: e.tamano ?? 1, minutosEstampado: e.minutosEstampado ?? 0 })) },
    })),
  );
  return NextResponse.json({ actualizados: cambios.length });
}
