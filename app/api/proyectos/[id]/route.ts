import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

function serializeProyecto(p: Record<string, unknown>) {
  return {
    ...p,
    moodboard: p.moodboard ? JSON.parse(p.moodboard as string) : [],
  };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const proyecto = await prisma.proyectoDiseno.findUnique({
      where: { id },
      include: {
        pasos: { orderBy: { numeroPaso: 'asc' } },
        iteraciones: {
          include: {
            ajustes: { orderBy: { createdAt: 'asc' } },
            insumos: true,
          },
          orderBy: { version: 'asc' },
        },
        ideas:   { orderBy: { createdAt: 'desc' } },
        insumos: { orderBy: { createdAt: 'asc' } },
        skus:    { orderBy: { codigo: 'asc' } },
      },
    });

    if (!proyecto) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const iteraciones = proyecto.iteraciones.map((it) => ({
      ...it,
      fotos:   it.fotos   ? JSON.parse(it.fotos)   : [],
      ajustes: it.ajustes.map((aj) => ({
        ...aj,
        fechaRealizado: aj.fechaRealizado?.toISOString() ?? null,
        createdAt:      aj.createdAt.toISOString(),
      })),
    }));

    const ideas = proyecto.ideas.map((idea) => ({
      ...idea,
      etiquetas: idea.etiquetas ? JSON.parse(idea.etiquetas) : [],
      createdAt: idea.createdAt.toISOString(),
    }));

    return NextResponse.json(serializeProyecto({
      ...proyecto,
      iteraciones,
      ideas,
      pasos: proyecto.pasos.map((p) => ({
        ...p,
        fechaInicio:     p.fechaInicio?.toISOString()     ?? null,
        fechaCompletado: p.fechaCompletado?.toISOString() ?? null,
        updatedAt:       p.updatedAt.toISOString(),
      })),
      insumos: proyecto.insumos.map((ins) => ({
        ...ins,
        createdAt: ins.createdAt.toISOString(),
        updatedAt: ins.updatedAt.toISOString(),
      })),
      skus: proyecto.skus.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
      createdAt: proyecto.createdAt.toISOString(),
      updatedAt: proyecto.updatedAt.toISOString(),
    }));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error obteniendo proyecto' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body   = await req.json();

    const data: Record<string, unknown> = {};

    const campos = [
      'nombre', 'marca', 'estado', 'estadoDiseno', 'inspiracion',
      'molderia', 'tela', 'costo', 'precioEstimado', 'estadoProduccion', 'cantidad',
    ] as const;

    for (const campo of campos) {
      if (body[campo] !== undefined) {
        data[campo] = body[campo] === '' && campo !== 'nombre' && campo !== 'marca'
          ? null
          : body[campo];
      }
    }

    if (body.moodboard !== undefined) {
      data.moodboard = JSON.stringify(body.moodboard);
    }

    const proyecto = await prisma.proyectoDiseno.update({ where: { id }, data });
    return NextResponse.json(serializeProyecto({ ...proyecto }));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error actualizando proyecto' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await prisma.proyectoDiseno.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error eliminando proyecto' }, { status: 500 });
  }
}
