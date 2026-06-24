import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requirePermiso } from '@/lib/auth';
import { ProveedorSchema } from '@/lib/validators/insumos';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const incluirInactivos = new URL(req.url).searchParams.get('incluirInactivos') === '1';
  const proveedores = await prisma.proveedor.findMany({
    where: incluirInactivos ? {} : { activo: true },
    orderBy: { nombre: 'asc' },
  });
  return NextResponse.json(proveedores);
}

export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'proveedores');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const body = await req.json();
  const parsed = ProveedorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const proveedor = await prisma.proveedor.create({ data: parsed.data });
  return NextResponse.json(proveedor, { status: 201 });
}
