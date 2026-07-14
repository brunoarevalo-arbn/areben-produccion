import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

// Canales de venta con sus formas de pago (comisiones) anidadas.
export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'precios'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const canales = await prisma.canalVenta.findMany({
    orderBy: { orden: 'asc' },
    include: { comisiones: { orderBy: { orden: 'asc' } } },
  });
  return NextResponse.json(canales);
}

export async function POST(req: NextRequest) {
  if (!(await requirePermiso(req, 'precios'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { nombre } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  const max = await prisma.canalVenta.aggregate({ _max: { orden: true } });
  const canal = await prisma.canalVenta.create({
    data: { nombre: nombre.trim(), orden: (max._max.orden ?? 0) + 1 },
    include: { comisiones: true },
  });
  return NextResponse.json(canal, { status: 201 });
}
