import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

// Marca un SKU producido como "no costear" (descartado). Reversible.
export async function POST(req: NextRequest) {
  if (!await requirePermiso(req, 'costos')) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { sku } = await req.json();
  if (!sku?.trim()) return NextResponse.json({ error: 'SKU requerido' }, { status: 400 });
  await prisma.costoSkuDescartado.upsert({
    where:  { sku: sku.trim() },
    update: {},
    create: { sku: sku.trim() },
  });
  return NextResponse.json({ ok: true });
}

// Recupera un SKU descartado (vuelve a pendientes).
export async function DELETE(req: NextRequest) {
  if (!await requirePermiso(req, 'costos')) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { sku } = await req.json();
  if (!sku?.trim()) return NextResponse.json({ error: 'SKU requerido' }, { status: 400 });
  await prisma.costoSkuDescartado.deleteMany({ where: { sku: sku.trim() } });
  return NextResponse.json({ ok: true });
}
