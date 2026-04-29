import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { id }    = await params;
    const { estado } = await req.json();

    const data: Record<string, unknown> = {};
    if (estado !== undefined) {
      data.estado = estado;
      if (estado === 'realizado' || estado === 'aprobado') {
        data.fechaRealizado = new Date();
      } else {
        data.fechaRealizado = null;
      }
    }

    const ajuste = await prisma.ajusteMuestra.update({ where: { id }, data });
    return NextResponse.json({
      ...ajuste,
      fechaRealizado: ajuste.fechaRealizado?.toISOString() ?? null,
      createdAt:      ajuste.createdAt.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error actualizando ajuste' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await prisma.ajusteMuestra.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error eliminando ajuste' }, { status: 500 });
  }
}
