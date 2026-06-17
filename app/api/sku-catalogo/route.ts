import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { requirePermiso } from '@/lib/auth';

// Lectura del catálogo (marcas, colores, prendas): cualquier usuario con acceso a
// alguna sección que lo consuma. Es data de referencia compartida.
const SECCIONES_CATALOGO = ['produccion', 'diseno', 'insumos', 'costos'];
async function requireCatalogoRead(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return null;
  if (session.rol === 'admin') return session;
  if (session.rol === 'costurera') return null;
  const user = await prisma.usuario.findUnique({ where: { id: session.id }, select: { permisos: true } });
  const tieneAcceso = SECCIONES_CATALOGO.some((p) => user?.permisos.includes(p));
  return tieneAcceso ? session : null;
}

const CreateSchema = z.object({
  categoria:   z.enum(['marca', 'prenda', 'color']),
  nombre:      z.string().min(1).max(60),
  abreviatura: z.string().min(1).max(8).regex(/^[A-Z0-9]+$/, 'Solo letras mayúsculas y números'),
  orden:       z.number().int().nonnegative().optional(),
});

export async function GET(req: NextRequest) {
  const session = await requireCatalogoRead(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const url = new URL(req.url);
  const categoria = url.searchParams.get('categoria');
  const where = categoria ? { categoria } : {};

  const entries = await prisma.skuCatalogo.findMany({
    where,
    orderBy: [{ categoria: 'asc' }, { orden: 'asc' }, { nombre: 'asc' }],
  });
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  try {
    const creado = await prisma.skuCatalogo.create({
      data: { ...parsed.data, abreviatura: parsed.data.abreviatura.toUpperCase() },
    });
    return NextResponse.json(creado, { status: 201 });
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'code' in err && err.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe una opción con esa abreviatura en esa categoría' }, { status: 409 });
    }
    throw err;
  }
}
