import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso, requireAdmin } from '@/lib/auth';

const ID = 'singleton';

// Precio fijo del DTF (rollo) + ancho + separación de corte + rechazo default. Global;
// lo setea admin. La separación entra en la TIRA (lib/costos/estampaCosto.ts): es cuánto
// margen se deja entre dos estampas, y en un diseño chico pesa tanto como el diseño.
export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'estamperia'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const cfg = await prisma.configCostos.upsert({ where: { id: ID }, create: { id: ID }, update: {} });
  return NextResponse.json({ dtfPrecioMetro: cfg.dtfPrecioMetro, dtfAnchoCm: cfg.dtfAnchoCm, dtfSeparacionCm: cfg.dtfSeparacionCm, dtfMermaDefault: cfg.dtfMermaDefault });
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
  const body = await req.json();
  const data = {
    dtfPrecioMetro: Number(body.dtfPrecioMetro) || 0,
    dtfAnchoCm:     Number(body.dtfAnchoCm) || 58,
    dtfSeparacionCm: Number(body.dtfSeparacionCm) || 0,
    dtfMermaDefault: Number(body.dtfMermaDefault) || 0,
  };
  const cfg = await prisma.configCostos.upsert({ where: { id: ID }, create: { id: ID, ...data }, update: data });
  return NextResponse.json({ dtfPrecioMetro: cfg.dtfPrecioMetro, dtfAnchoCm: cfg.dtfAnchoCm, dtfSeparacionCm: cfg.dtfSeparacionCm, dtfMermaDefault: cfg.dtfMermaDefault });
}
