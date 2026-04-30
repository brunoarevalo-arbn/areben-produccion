import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySession(token))) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });
  const items = await prisma.telaCatalogo.findMany({ orderBy: { nombre: 'asc' } });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });
  const { nombre } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  try {
    const item = await prisma.telaCatalogo.create({ data: { nombre: nombre.trim() } });
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Ya existe una tela con ese nombre' }, { status: 409 });
  }
}
