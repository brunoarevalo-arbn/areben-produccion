import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const ideas  = await prisma.ideaDiseno.findMany({
      where:   { proyectoId: id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(ideas.map((idea) => ({
      ...idea,
      etiquetas: idea.etiquetas ? JSON.parse(idea.etiquetas) : [],
      createdAt: idea.createdAt.toISOString(),
    })));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error obteniendo ideas' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id }                             = await params;
    const { titulo, descripcion, foto, etiquetas } = await req.json();

    if (!descripcion?.trim()) {
      return NextResponse.json({ error: 'Descripción requerida' }, { status: 400 });
    }

    const idea = await prisma.ideaDiseno.create({
      data: {
        proyectoId:  id,
        titulo:      titulo?.trim()      || null,
        descripcion: descripcion.trim(),
        foto:        foto                || null,
        etiquetas:   etiquetas ? JSON.stringify(etiquetas) : null,
      },
    });

    return NextResponse.json({
      ...idea,
      etiquetas: idea.etiquetas ? JSON.parse(idea.etiquetas) : [],
      createdAt: idea.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error creando idea' }, { status: 500 });
  }
}
