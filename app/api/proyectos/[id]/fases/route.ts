import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

const PostSchema = z.object({ faseId: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const parsed = PostSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  try {
    const creada = await prisma.faseProyecto.create({
      data:    { proyectoId: id, faseId: parsed.data.faseId, estado: 'en_progreso', fechaInicio: new Date() },
      include: { fase: true },
    });
    return NextResponse.json(creada, { status: 201 });
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'code' in err && err.code === 'P2002') {
      return NextResponse.json({ error: 'La fase ya está iniciada para este proyecto' }, { status: 409 });
    }
    throw err;
  }
}
