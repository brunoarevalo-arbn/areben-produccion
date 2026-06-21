import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { requireAlguno } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySession(token))) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });
  const items = await prisma.etiquetaCatalogo.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  if (!(await requireAlguno(req, ['costos', 'insumos']))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { nombre, tipo, categoria, unidad, marca, precio, stock, proveedorId } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  const item = await prisma.etiquetaCatalogo.create({
    data: {
      nombre: nombre.trim(), tipo: tipo?.trim() || null,
      categoria: categoria?.trim() || null, unidad: unidad?.trim() || null, marca: marca?.trim() || null,
      precio: parseFloat(precio) || 0,
      stock: typeof stock === 'number' ? Math.max(0, Math.trunc(stock)) : null,
      proveedorId: proveedorId || null,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
