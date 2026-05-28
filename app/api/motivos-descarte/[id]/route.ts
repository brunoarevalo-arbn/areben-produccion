import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { MotivoDescarteSchema } from '@/lib/validators/produccion';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });
  if (session.rol !== 'admin' && session.rol !== 'diseñadora') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = MotivoDescarteSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const motivo = await prisma.motivoDescarte.update({ where: { id }, data: parsed.data });
  return NextResponse.json(motivo);
}
