import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

const ID = 'singleton';

// Impuestos globales del área Precios (sobre ConfigCostos, reusa su ivaVenta como IVA).
// Config compartida: la editan quienes tienen el permiso 'precios', la ve todo el equipo.
export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'precios'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const cfg = await prisma.configCostos.upsert({ where: { id: ID }, create: { id: ID }, update: {} });
  return NextResponse.json({
    ivaVenta: cfg.ivaVenta, iibbPct: cfg.iibbPct, dreiPct: cfg.dreiPct,
    gananciasPct: cfg.gananciasPct, saldoIvaFavor: cfg.saldoIvaFavor,
  });
}

export async function PUT(req: NextRequest) {
  if (!(await requirePermiso(req, 'precios'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const b = await req.json();
  const data: Record<string, number | boolean> = {};
  if (b.ivaVenta !== undefined)      data.ivaVenta      = Number(b.ivaVenta) || 0;
  if (b.iibbPct !== undefined)       data.iibbPct       = Number(b.iibbPct) || 0;
  if (b.dreiPct !== undefined)       data.dreiPct       = Number(b.dreiPct) || 0;
  if (b.gananciasPct !== undefined)  data.gananciasPct  = Number(b.gananciasPct) || 0;
  if (b.saldoIvaFavor !== undefined) data.saldoIvaFavor = !!b.saldoIvaFavor;
  const cfg = await prisma.configCostos.upsert({ where: { id: ID }, create: { id: ID, ...data }, update: data });
  return NextResponse.json({
    ivaVenta: cfg.ivaVenta, iibbPct: cfg.iibbPct, dreiPct: cfg.dreiPct,
    gananciasPct: cfg.gananciasPct, saldoIvaFavor: cfg.saldoIvaFavor,
  });
}
