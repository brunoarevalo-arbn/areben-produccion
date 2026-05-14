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
  nombre: z.string().min(1).max(60).optional(),
  orden:  z.number().int().nonnegative().optional(),
  activo: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireDisenoAccess(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  try {
    const actualizado = await prisma.faseCatalogo.update({ where: { id }, data: parsed.data });
    return NextResponse.json(actualizado);
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'code' in err && err.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe una fase con ese nombre' }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireDisenoAccess(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  // Si hay FaseProyecto que la referencian, prisma falla. Mejor desactivar.
  const enUso = await prisma.faseProyecto.count({ where: { faseId: id } });
  if (enUso > 0) {
    return NextResponse.json({ error: 'Fase en uso por proyectos. Desactivala en lugar de borrarla.' }, { status: 409 });
  }
  await prisma.faseCatalogo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
