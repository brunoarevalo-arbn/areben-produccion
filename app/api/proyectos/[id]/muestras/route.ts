import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

function serializeIteracion(it: Record<string, unknown> & {
  ajustes: Array<Record<string, unknown>>;
  insumos: Array<Record<string, unknown>>;
}) {
  return {
    ...it,
    fotos:     it.fotos ? JSON.parse(it.fotos as string) : [],
    ajustes:   it.ajustes.map((aj) => ({
      ...aj,
      fechaRealizado: (aj.fechaRealizado as Date | null)?.toISOString() ?? null,
      createdAt:      (aj.createdAt as Date).toISOString(),
    })),
    createdAt: (it.createdAt as Date).toISOString(),
    updatedAt: (it.updatedAt as Date).toISOString(),
  };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const iteraciones = await prisma.iteracionMuestra.findMany({
      where:   { proyectoId: id },
      include: { ajustes: { orderBy: { createdAt: 'asc' } }, insumos: true },
      orderBy: { version: 'asc' },
    });
    return NextResponse.json(iteraciones.map((it) => serializeIteracion(it as never)));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error obteniendo muestras' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  try {
    const { id }    = await params;
    const body      = await req.json().catch(() => ({}));
    const tipo: string = body.tipo ?? 'muestra';

    const ultima = await prisma.iteracionMuestra.findFirst({
      where:   { proyectoId: id },
      orderBy: { version: 'desc' },
    });

    const version = (ultima?.version ?? 0) + 1;

    const nueva = await prisma.iteracionMuestra.create({
      data:    { proyectoId: id, version, tipo },
      include: { ajustes: true, insumos: true },
    });

    return NextResponse.json(serializeIteracion(nueva as never), { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error creando muestra' }, { status: 500 });
  }
}
