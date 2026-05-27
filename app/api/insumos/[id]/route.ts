import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireInsumos } from '@/lib/auth';
import { InsumoCatalogoSchema } from '@/lib/validators/insumos';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await requireInsumos(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = InsumoCatalogoSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const insumo = await prisma.insumo.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json(insumo);
}
