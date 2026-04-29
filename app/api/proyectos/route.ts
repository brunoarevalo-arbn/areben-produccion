import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PASOS_DISENO } from '@/lib/constants/diseno';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const marca = searchParams.get('marca') ?? undefined;

    const proyectos = await prisma.proyectoDiseno.findMany({
      where: marca ? { marca } : undefined,
      include: { pasos: { orderBy: { numeroPaso: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(proyectos);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error obteniendo proyectos' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { ids, data } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDs requeridos' }, { status: 400 });
    }

    const update: Record<string, string> = {};
    if (data.estado && ['activo', 'standby', 'archivado'].includes(data.estado)) {
      update.estado = data.estado;
    }
    if (data.marca && ['Zattia', 'Stunned'].includes(data.marca)) {
      update.marca = data.marca;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Sin cambios válidos' }, { status: 400 });
    }

    await prisma.proyectoDiseno.updateMany({ where: { id: { in: ids } }, data: update });
    return NextResponse.json({ ok: true, count: ids.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error actualizando proyectos' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDs requeridos' }, { status: 400 });
    }

    await prisma.proyectoDiseno.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ ok: true, count: ids.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error eliminando proyectos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, marca, inspiracion } = body;

    if (!nombre?.trim() || !marca?.trim()) {
      return NextResponse.json({ error: 'Nombre y marca son requeridos' }, { status: 400 });
    }

    const proyecto = await prisma.proyectoDiseno.create({
      data: {
        nombre: nombre.trim(),
        marca,
        inspiracion: inspiracion?.trim() || null,
        pasos: {
          create: PASOS_DISENO.map((nombrePaso, i) => ({
            numeroPaso: i + 1,
            nombrePaso,
            estado: 'pendiente',
          })),
        },
      },
      include: { pasos: { orderBy: { numeroPaso: 'asc' } } },
    });

    return NextResponse.json(proyecto, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error creando proyecto' }, { status: 500 });
  }
}
