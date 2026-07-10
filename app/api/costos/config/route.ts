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
  // Update parcial: solo tocamos los campos presentes en el body (así guardar
  // márgenes no pisa la tarifa de estampería y viceversa).
  const data: Record<string, number> = {};
  if (body.margenDesarrollo !== undefined)   data.margenDesarrollo   = Number(body.margenDesarrollo) || 0;
  if (body.margenFallas !== undefined)       data.margenFallas       = Number(body.margenFallas) || 0;
  if (body.estampadoValorHora !== undefined) data.estampadoValorHora = Number(body.estampadoValorHora) || 0;
  const cfg = await prisma.configCostos.upsert({
    where:  { id: ID },
    create: { id: ID, ...data },
    update: data,
  });
  return NextResponse.json(cfg);
}
