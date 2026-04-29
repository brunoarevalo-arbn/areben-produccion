import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string; ideaId: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { ideaId }                          = await params;
    const { titulo, descripcion, foto, etiquetas } = await req.json();

    const data: Record<string, unknown> = {};
    if (titulo      !== undefined) data.titulo      = titulo?.trim()       || null;
    if (descripcion !== undefined) data.descripcion = descripcion.trim();
    if (foto        !== undefined) data.foto        = foto                 || null;
    if (etiquetas   !== undefined) data.etiquetas   = JSON.stringify(etiquetas);

    const idea = await prisma.ideaDiseno.update({ where: { id: ideaId }, data });
    return NextResponse.json({
      ...idea,
      etiquetas: idea.etiquetas ? JSON.parse(idea.etiquetas) : [],
      createdAt: idea.createdAt.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error actualizando idea' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { ideaId } = await params;
    await prisma.ideaDiseno.delete({ where: { id: ideaId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error eliminando idea' }, { status: 500 });
  }
}
