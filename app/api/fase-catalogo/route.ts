import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

// Cualquier no-costurera con acceso a /diseno puede leer y escribir.
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

const CreateSchema = z.object({
  nombre: z.string().min(1).max(60),
  orden:  z.number().int().nonnegative().optional(),
});

export async function GET(req: NextRequest) {
  const session = await requireDisenoAccess(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const fases = await prisma.faseCatalogo.findMany({ orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] });
  return NextResponse.json(fases);
}

export async function POST(req: NextRequest) {
  const session = await requireDisenoAccess(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  try {
    const creado = await prisma.faseCatalogo.create({ data: { ...parsed.data, nombre: parsed.data.nombre.trim() } });
    return NextResponse.json(creado, { status: 201 });
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'code' in err && err.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe una fase con ese nombre' }, { status: 409 });
    }
    throw err;
  }
}
