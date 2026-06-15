import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { requirePermiso } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySession(token))) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });
  const gastos = await prisma.gastoFijoTaller.findMany({ orderBy: { createdAt: 'asc' } });
  return NextResponse.json(gastos);
}

export async function POST(req: NextRequest) {
  if (!await requirePermiso(req, 'costos')) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { nombre, monto, categoria } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  const gasto = await prisma.gastoFijoTaller.create({
    data: { nombre: nombre.trim(), monto: parseFloat(monto) || 0, categoria: categoria || 'otro' },
  });
  return NextResponse.json(gasto, { status: 201 });
}
