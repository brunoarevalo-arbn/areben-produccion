import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    await params;
    const { iteracionId, muestraId, descripcion } = await req.json();

    const targetId = iteracionId ?? muestraId;
    if (!targetId || !descripcion?.trim()) {
      return NextResponse.json({ error: 'iteracionId y descripcion son requeridos' }, { status: 400 });
    }

    const ajuste = await prisma.ajusteMuestra.create({
      data: { iteracionId: targetId, descripcion: descripcion.trim() },
    });

    return NextResponse.json({
      ...ajuste,
      fechaRealizado: ajuste.fechaRealizado?.toISOString() ?? null,
      createdAt:      ajuste.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error creando ajuste' }, { status: 500 });
  }
}
