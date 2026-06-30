import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const session = await requirePermiso(req, 'reposicion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const cfg = await prisma.reposicionConfig.upsert({ where: { id: 'main' }, create: { id: 'main' }, update: {} });
  return NextResponse.json(cfg);
}

const ConfigSchema = z.object({ minimoDefault: z.number().int().min(0) });

export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'reposicion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const parsed = ConfigSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const cfg = await prisma.reposicionConfig.upsert({
    where: { id: 'main' }, create: { id: 'main', minimoDefault: parsed.data.minimoDefault }, update: { minimoDefault: parsed.data.minimoDefault },
  });
  return NextResponse.json(cfg);
}
