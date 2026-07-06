import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso, requireAdmin } from '@/lib/auth';

const ID = 'singleton';

// Precio fijo del DTF (rollo) + ancho + merma default. Global; lo setea admin.
export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'estamperia'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const cfg = await prisma.configCostos.upsert({ where: { id: ID }, create: { id: ID }, update: {} });
  return NextResponse.json({ dtfPrecioMetro: cfg.dtfPrecioMetro, dtfAnchoCm: cfg.dtfAnchoCm, dtfMermaDefault: cfg.dtfMermaDefault });
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
  const body = await req.json();
  const data = {
    dtfPrecioMetro: Number(body.dtfPrecioMetro) || 0,
    dtfAnchoCm:     Number(body.dtfAnchoCm) || 58,
    dtfMermaDefault: Number(body.dtfMermaDefault) || 0,
  };
  const cfg = await prisma.configCostos.upsert({ where: { id: ID }, create: { id: ID, ...data }, update: data });
  return NextResponse.json({ dtfPrecioMetro: cfg.dtfPrecioMetro, dtfAnchoCm: cfg.dtfAnchoCm, dtfMermaDefault: cfg.dtfMermaDefault });
}
