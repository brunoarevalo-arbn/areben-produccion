import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'precios'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const b = await req.json();
  const data: Record<string, unknown> = {};
  if (b.nombre !== undefined)             data.nombre             = String(b.nombre).trim();
  if (b.comisionPct !== undefined)        data.comisionPct        = Number(b.comisionPct) || 0;
  if (b.costoFinancieroPct !== undefined) data.costoFinancieroPct = Number(b.costoFinancieroPct) || 0;
  if (b.descuentoPct !== undefined)       data.descuentoPct       = Number(b.descuentoPct) || 0;
  if (b.aplicaImpuestos !== undefined)    data.aplicaImpuestos    = !!b.aplicaImpuestos;
  if (b.diasAcreditacion !== undefined)   data.diasAcreditacion   = Math.round(Number(b.diasAcreditacion) || 0);
  const forma = await prisma.comisionPago.update({ where: { id }, data });
  return NextResponse.json(forma);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'precios'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  await prisma.comisionPago.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
