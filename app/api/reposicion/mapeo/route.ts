import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { z } from 'zod';

const MapeoSchema = z.object({
  gnId:     z.number().int(),
  gnCode:   z.string().optional(),
  gnNombre: z.string().optional(),
  skuLiso:  z.string().min(1, 'Falta el SKU del liso').transform((s) => s.trim().toUpperCase()),
});

export async function GET(req: NextRequest) {
  const session = await requirePermiso(req, 'reposicion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const mapeos = await prisma.reposicionMapeo.findMany({ where: { activo: true }, orderBy: [{ skuLiso: 'asc' }] });
  return NextResponse.json(mapeos);
}

export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'reposicion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const parsed = MapeoSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { gnId, gnCode, gnNombre, skuLiso } = parsed.data;
  const mapeo = await prisma.reposicionMapeo.upsert({
    where:  { gnId },
    create: { gnId, gnCode: gnCode || null, gnNombre: gnNombre || null, skuLiso, activo: true },
    update: { gnCode: gnCode || null, gnNombre: gnNombre || null, skuLiso, activo: true },
  });
  return NextResponse.json(mapeo, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await requirePermiso(req, 'reposicion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const gnId = Number(new URL(req.url).searchParams.get('gnId'));
  if (!gnId) return NextResponse.json({ error: 'Falta gnId' }, { status: 400 });
  await prisma.reposicionMapeo.deleteMany({ where: { gnId } });
  return NextResponse.json({ deleted: true });
}
