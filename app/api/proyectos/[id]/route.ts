import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { parseFotos, serializeFotos } from '@/lib/diseno/fotos';

type Ctx = { params: Promise<{ id: string }> };

function serializeProyecto(p: Record<string, unknown>) {
  return {
    ...p,
    moodboard: parseFotos(p.moodboard),
  };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const proyecto = await prisma.proyectoDiseno.findUnique({
      where: { id },
      include: {
        fases: { include: { fase: true }, orderBy: { fase: { orden: 'asc' } } },
        iteraciones: {
          include: { ajustes: { orderBy: { createdAt: 'asc' } }, insumos: true },
          orderBy: { version: 'asc' },
        },
        insumos: { orderBy: { createdAt: 'asc' } },
        skus:    { orderBy: { codigo: 'asc' } },
      },
    });

    if (!proyecto) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const iteraciones = proyecto.iteraciones.map((it) => ({
      ...it,
      fotos:   it.fotos ? JSON.parse(it.fotos) : [],
      ajustes: it.ajustes.map((aj) => ({
        ...aj,
        fechaRealizado: aj.fechaRealizado?.toISOString() ?? null,
        createdAt:      aj.createdAt.toISOString(),
      })),
    }));

    return NextResponse.json(serializeProyecto({
      ...proyecto,
      iteraciones,
      fases: proyecto.fases.map((f) => ({
        ...f,
        fechaInicio: f.fechaInicio?.toISOString() ?? null,
        fechaFin:    f.fechaFin?.toISOString()    ?? null,
        createdAt:   f.createdAt.toISOString(),
        updatedAt:   f.updatedAt.toISOString(),
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
      fechaObjetivo: proyecto.fechaObjetivo?.toISOString() ?? null,
      createdAt:     proyecto.createdAt.toISOString(),
      updatedAt:     proyecto.updatedAt.toISOString(),
    }));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error obteniendo proyecto' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  try {
    const { id } = await params;
    const body   = await req.json();

    const data: Record<string, unknown> = {};
    const campos = ['nombre', 'marca', 'inspiracion', 'molderia', 'molderiaFormato', 'tela'] as const;

    for (const campo of campos) {
      if (body[campo] !== undefined) {
        data[campo] = body[campo] === '' && campo !== 'nombre' && campo !== 'marca'
          ? null
          : body[campo];
      }
    }

    if (typeof body.archivado === 'boolean') data.archivado = body.archivado;

    if (body.moodboard !== undefined) {
      data.moodboard = serializeFotos(body.moodboard);
    }

    if (body.fechaObjetivo !== undefined) {
      data.fechaObjetivo = body.fechaObjetivo ? new Date(body.fechaObjetivo) : null;
    }

    const proyecto = await prisma.proyectoDiseno.update({ where: { id }, data });
    return NextResponse.json(serializeProyecto({ ...proyecto }));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error actualizando proyecto' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  try {
    const { id } = await params;
    await prisma.proyectoDiseno.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error eliminando proyecto' }, { status: 500 });
  }
}
