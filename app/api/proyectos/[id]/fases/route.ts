import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

async function requireDisenoAccess(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return null;
  if (session.rol === 'admin') return session;
  if (session.rol === 'costurera') return null;
  const user = await prisma.usuario.findUnique({ where: { id: session.id }, select: { permisos: true } });
  if (!user?.permisos.includes('diseno')) return session;
  return null;
}

const PostSchema = z.object({ faseId: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireDisenoAccess(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

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
