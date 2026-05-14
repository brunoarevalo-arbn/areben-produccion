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

const PatchSchema = z.object({
  estado:          z.enum(['en_progreso', 'completada']).optional(),
  responsable:     z.string().nullable().optional(),
  externo:         z.boolean().optional(),
  seguidorInterno: z.string().nullable().optional(),
  fechaFin:        z.string().nullable().optional(),
  notas:           z.string().nullable().optional(),
});

type Ctx = { params: Promise<{ id: string; faseProyectoId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await requireDisenoAccess(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { faseProyectoId } = await params;
  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.fechaFin !== undefined) {
    data.fechaFin = parsed.data.fechaFin ? new Date(parsed.data.fechaFin) : null;
  }
  // Auto-set fechaFin si pasa a completada y no se especificó
  if (parsed.data.estado === 'completada' && parsed.data.fechaFin === undefined) {
    data.fechaFin = new Date();
  }
  if (parsed.data.estado === 'en_progreso') {
    data.fechaFin = null;
  }

  const actualizada = await prisma.faseProyecto.update({
    where:   { id: faseProyectoId },
    data,
    include: { fase: true },
  });
  return NextResponse.json(actualizada);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await requireDisenoAccess(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { faseProyectoId } = await params;
  await prisma.faseProyecto.delete({ where: { id: faseProyectoId } });
  return NextResponse.json({ ok: true });
}
