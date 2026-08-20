import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { normalizarLisoRef, lisoRefValida, ERROR_LISO } from '@/lib/costos/lisoRef';

export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'costos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const productos = await prisma.productoEstampado.findMany({ orderBy: { updatedAt: 'desc' } });
  return NextResponse.json(productos);
}

export async function POST(req: NextRequest) {
  if (!(await requirePermiso(req, 'costos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const body = await req.json();
  const { nombre, sku, marca, estampas, notas } = body;
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  const liso = normalizarLisoRef(body);
  if (!lisoRefValida(liso)) return NextResponse.json({ error: ERROR_LISO }, { status: 400 });
  const producto = await prisma.productoEstampado.create({
    data: {
      nombre: nombre.trim(),
      sku: sku?.trim() || null,
      marca: marca?.trim() || null,
      ...liso,
      estampas: Array.isArray(estampas) ? estampas : [],
      notas: notas?.trim() || null,
    },
  });
  return NextResponse.json(producto, { status: 201 });
}
