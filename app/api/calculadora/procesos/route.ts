import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { MAQUINAS } from '@/lib/constants/maquinas';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'calculadora'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const procesos = await prisma.procesoPrenda.findMany({
    orderBy: [{ tipoPrenda: 'asc' }, { version: 'desc' }],
    include: { pasos: { orderBy: { orden: 'asc' } } },
  });

  return NextResponse.json(procesos.map((p) => ({
    id: p.id, tipoPrenda: p.tipoPrenda, version: p.version, vigente: p.vigente,
    aprobadoPor: p.aprobadoPor, aprobadoAt: p.aprobadoAt, origenCorridaId: p.origenCorridaId,
    notas: p.notas,
    pasos: p.pasos.map((x) => ({ id: x.id, orden: x.orden, nombre: x.nombre, maquina: x.maquina })),
  })));
}

const AprobarSchema = z.object({
  tipoPrenda: z.string().trim().min(1, 'Falta el tipo de prenda').max(60),
  origenCorridaId: z.string().trim().optional().nullable(),
  notas: z.string().trim().max(500).optional().nullable(),
  pasos: z
    .array(z.object({
      nombre: z.string().trim().min(1, 'Cada paso necesita nombre').max(60),
      maquina: z.enum(MAQUINAS),
      notas: z.string().trim().max(200).optional().nullable(),
    }))
    .min(1, 'El proceso necesita al menos un paso'),
});

// Aprueba una versión nueva del proceso de un tipo de prenda. La anterior deja
// de ser vigente pero NO se borra, y ninguna corrida ya medida se toca: sus
// pasos son copias propias.
export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'calculadora');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const parsed = AprobarSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  const proceso = await prisma.$transaction(async (tx) => {
    const ultimo = await tx.procesoPrenda.findFirst({
      where: { tipoPrenda: d.tipoPrenda },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    await tx.procesoPrenda.updateMany({ where: { tipoPrenda: d.tipoPrenda, vigente: true }, data: { vigente: false } });

    return tx.procesoPrenda.create({
      data: {
        tipoPrenda: d.tipoPrenda,
        version: (ultimo?.version ?? 0) + 1,
        vigente: true,
        aprobadoPor: session.nombre,
        aprobadoAt: new Date(),
        origenCorridaId: d.origenCorridaId || null,
        notas: d.notas || null,
        pasos: {
          create: d.pasos.map((p, i) => ({
            orden: i + 1, nombre: p.nombre, maquina: p.maquina, notas: p.notas || null,
          })),
        },
      },
      include: { pasos: { orderBy: { orden: 'asc' } } },
    });
  });

  return NextResponse.json(proceso, { status: 201 });
}
