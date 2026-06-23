import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requirePermiso } from '@/lib/auth';
import { MotivoDescarteSchema } from '@/lib/validators/produccion';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const motivos = await prisma.motivoDescarte.findMany({
    orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
  });
  return NextResponse.json(motivos);
}

export async function POST(req: NextRequest) {
  if (!(await requirePermiso(req, 'motivos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const body = await req.json();
  const parsed = MotivoDescarteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const motivo = await prisma.motivoDescarte.create({
    data: { nombre: parsed.data.nombre.trim(), categoria: parsed.data.categoria },
  });
  return NextResponse.json(motivo, { status: 201 });
}
