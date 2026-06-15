import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string; muestraId: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  try {
    const { muestraId } = await params;
    const { estado, notas, fotos, ajustesMolderia } = await req.json();

    const data: Record<string, unknown> = {};
    if (estado           !== undefined) data.estado          = estado;
    if (notas            !== undefined) data.notas           = notas            || null;
    if (fotos            !== undefined) data.fotos           = JSON.stringify(fotos);
    if (ajustesMolderia  !== undefined) data.ajustesMolderia = ajustesMolderia  || null;

    const it = await prisma.iteracionMuestra.update({
      where:   { id: muestraId },
      data,
      include: { ajustes: { orderBy: { createdAt: 'asc' } }, insumos: true },
    });

    return NextResponse.json({
      ...it,
      fotos:     it.fotos ? JSON.parse(it.fotos) : [],
      ajustes:   it.ajustes.map((aj) => ({
        ...aj,
        fechaRealizado: aj.fechaRealizado?.toISOString() ?? null,
        createdAt:      aj.createdAt.toISOString(),
      })),
      createdAt: it.createdAt.toISOString(),
      updatedAt: it.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error actualizando muestra' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  try {
    const { muestraId } = await params;
    await prisma.iteracionMuestra.delete({ where: { id: muestraId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error eliminando muestra' }, { status: 500 });
  }
}
