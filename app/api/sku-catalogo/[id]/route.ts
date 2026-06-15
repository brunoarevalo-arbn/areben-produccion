import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

const PatchSchema = z.object({
  nombre:      z.string().min(1).max(60).optional(),
  abreviatura: z.string().min(1).max(8).regex(/^[A-Z0-9]+$/).optional(),
  orden:       z.number().int().nonnegative().optional(),
  activo:      z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const data = { ...parsed.data, ...(parsed.data.abreviatura ? { abreviatura: parsed.data.abreviatura.toUpperCase() } : {}) };

  try {
    const actualizado = await prisma.skuCatalogo.update({ where: { id }, data });
    return NextResponse.json(actualizado);
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'code' in err && err.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe una opción con esa abreviatura en esa categoría' }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requirePermiso(req, 'diseno'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  await prisma.skuCatalogo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
