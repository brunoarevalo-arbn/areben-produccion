import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

// Crea una forma de pago dentro de un canal.
export async function POST(req: NextRequest) {
  if (!(await requirePermiso(req, 'precios'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { canalId, nombre } = await req.json();
  if (!canalId) return NextResponse.json({ error: 'Canal requerido' }, { status: 400 });
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  const max = await prisma.comisionPago.aggregate({ where: { canalId }, _max: { orden: true } });
  const forma = await prisma.comisionPago.create({
    data: { canalId, nombre: nombre.trim(), orden: (max._max.orden ?? 0) + 1 },
  });
  return NextResponse.json(forma, { status: 201 });
}
