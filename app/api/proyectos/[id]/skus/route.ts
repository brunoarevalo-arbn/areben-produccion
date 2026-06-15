import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

function serialize(s: Record<string, unknown>) {
  return {
    ...s,
    createdAt: (s.createdAt as Date).toISOString(),
    updatedAt: (s.updatedAt as Date).toISOString(),
  };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const skus   = await prisma.sKUProyecto.findMany({
      where:   { proyectoId: id },
      orderBy: { codigo: 'asc' },
    });
    return NextResponse.json(skus.map((s) => serialize(s as never)));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error obteniendo SKUs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  try {
    const { id } = await params;
    const { codigo, talle, color, cantidad, notas } = await req.json();

    if (!codigo?.trim()) {
      return NextResponse.json({ error: 'Código requerido' }, { status: 400 });
    }

    const sku = await prisma.sKUProyecto.create({
      data: {
        proyectoId: id,
        codigo:     codigo.trim().toUpperCase(),
        talle:      talle    || null,
        color:      color    || null,
        cantidad:   cantidad ?? 0,
        notas:      notas    || null,
      },
    });

    return NextResponse.json(serialize(sku as never), { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error creando SKU' }, { status: 500 });
  }
}
