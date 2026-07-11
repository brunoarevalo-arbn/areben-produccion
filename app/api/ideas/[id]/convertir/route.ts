import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

// Convierte una idea en ProyectoDiseno copiando fotos → moodboard y notas →
// inspiración. Deja la traza en idea.proyectoId. Idempotente si ya está convertida.
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const idea = await prisma.idea.findUnique({ where: { id } });
  if (!idea) return NextResponse.json({ error: 'Idea no encontrada' }, { status: 404 });
  if (idea.proyectoId) return NextResponse.json({ proyectoId: idea.proyectoId });

  const proyecto = await prisma.$transaction(async (tx) => {
    const p = await tx.proyectoDiseno.create({
      data: { nombre: idea.nombre, marca: idea.marca, moodboard: idea.fotos ?? null, inspiracion: idea.notas ?? null },
    });
    await tx.idea.update({ where: { id }, data: { proyectoId: p.id } });
    return p;
  });
  return NextResponse.json({ proyectoId: proyecto.id }, { status: 201 });
}
