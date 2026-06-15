import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

const ID = 'singleton';

// Márgenes globales (política del negocio). El escandallo los aplica solos;
// no se cargan por producto.
export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'costos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const cfg = await prisma.configCostos.upsert({ where: { id: ID }, create: { id: ID }, update: {} });
  return NextResponse.json(cfg);
}

export async function PUT(req: NextRequest) {
  if (!(await requirePermiso(req, 'costos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const body = await req.json();
  const cfg = await prisma.configCostos.upsert({
    where:  { id: ID },
    create: { id: ID, margenDesarrollo: Number(body.margenDesarrollo) || 0, margenFallas: Number(body.margenFallas) || 0 },
    update: { margenDesarrollo: Number(body.margenDesarrollo) || 0, margenFallas: Number(body.margenFallas) || 0 },
  });
  return NextResponse.json(cfg);
}
