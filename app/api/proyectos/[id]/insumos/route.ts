import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

function serialize(ins: Record<string, unknown>) {
  return {
    ...ins,
    createdAt: (ins.createdAt as Date).toISOString(),
    updatedAt: (ins.updatedAt as Date).toISOString(),
  };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const insumos = await prisma.proyectoInsumo.findMany({
      where:   { proyectoId: id },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(insumos.map((i) => serialize(i as never)));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error obteniendo insumos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { nombre, tipo, proveedor, unidad, cantidad, costoUnitario, notas } = await req.json();

    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
    }

    const insumo = await prisma.proyectoInsumo.create({
      data: {
        proyectoId:    id,
        nombre:        nombre.trim(),
        tipo:          tipo          || null,
        proveedor:     proveedor     || null,
        unidad:        unidad        || 'm',
        cantidad:      cantidad      ?? 0,
        costoUnitario: costoUnitario ?? 0,
        notas:         notas         || null,
      },
    });

    return NextResponse.json(serialize(insumo as never), { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error creando insumo' }, { status: 500 });
  }
}
