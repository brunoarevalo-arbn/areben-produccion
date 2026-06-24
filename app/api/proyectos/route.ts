import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const marca = searchParams.get('marca') ?? undefined;

    const proyectos = await prisma.proyectoDiseno.findMany({
      where:    marca ? { marca } : undefined,
      orderBy:  { createdAt: 'desc' },
    });

    return NextResponse.json(proyectos);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error obteniendo proyectos' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  try {
    const { ids, data } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDs requeridos' }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (typeof data.archivado === 'boolean') update.archivado = data.archivado;
    if (data.marca && ['Zattia', 'Stunned'].includes(data.marca)) update.marca = data.marca;

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
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
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
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  try {
    const body = await req.json();
    const { nombre, marca, inspiracion } = body;

    if (!nombre?.trim() || !marca?.trim()) {
      return NextResponse.json({ error: 'Nombre y marca son requeridos' }, { status: 400 });
    }

    const proyecto = await prisma.proyectoDiseno.create({
      data: {
        nombre:      nombre.trim(),
        marca,
        inspiracion: inspiracion?.trim() || null,
      },
    });

    return NextResponse.json(proyecto, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error creando proyecto' }, { status: 500 });
  }
}
