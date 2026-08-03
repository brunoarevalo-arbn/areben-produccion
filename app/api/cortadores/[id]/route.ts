import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { CortadorSchema } from '@/lib/validators/produccion';
import { dejarUnicoPredeterminado } from '@/lib/produccion/cortador-default';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'cortadores'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = CortadorSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const data: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.nombre !== undefined) data.nombre = d.nombre.trim();
  if (d.contacto !== undefined) data.contacto = d.contacto || null;
  if (d.notas !== undefined) data.notas = d.notas || null;
  if (d.activo !== undefined) data.activo = d.activo;
  if (d.usuarioId !== undefined) data.usuarioId = d.usuarioId || null;
  if (d.predeterminado !== undefined) data.predeterminado = d.predeterminado;
  // Un cortador dado de baja no puede quedar como predeterminado.
  if (d.activo === false) data.predeterminado = false;

  const cortador = await prisma.$transaction(async (tx) => {
    const c = await tx.cortador.update({ where: { id }, data });
    if (data.predeterminado === true) await dejarUnicoPredeterminado(tx, id);
    return c;
  });
  return NextResponse.json(cortador);
}
