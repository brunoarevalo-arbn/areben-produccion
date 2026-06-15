import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { CortadorSchema } from '@/lib/validators/produccion';
import { Prisma } from '@prisma/client';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'configuracion'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = CortadorSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const data: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.nombre !== undefined) data.nombre = d.nombre.trim();
  if (d.contacto !== undefined) data.contacto = d.contacto || null;
  if (d.tarifaDefault !== undefined) data.tarifaDefault = d.tarifaDefault !== null ? new Prisma.Decimal(d.tarifaDefault) : null;
  if (d.tarifaModo !== undefined) data.tarifaModo = d.tarifaModo || null;
  if (d.notas !== undefined) data.notas = d.notas || null;
  if (d.activo !== undefined) data.activo = d.activo;

  const cortador = await prisma.cortador.update({ where: { id }, data });
  return NextResponse.json(cortador);
}
