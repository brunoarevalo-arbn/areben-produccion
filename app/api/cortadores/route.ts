import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requirePermiso } from '@/lib/auth';
import { CortadorSchema } from '@/lib/validators/produccion';
import { dejarUnicoPredeterminado } from '@/lib/produccion/cortador-default';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  // Sale con `getSession` a propósito (lo consume medio módulo de producción), así que
  // NO devuelve la tarifa: es plata pactada y un cortador logueado leería la de todos.
  // Quien la necesita la lee server-side (carga-tizada) o la recibe del POST/PUT, que
  // sí exigen permiso `cortadores`.
  const cortadores = await prisma.cortador.findMany({
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true, contacto: true, activo: true, usuarioId: true, predeterminado: true },
  });
  return NextResponse.json(cortadores);
}

export async function POST(req: NextRequest) {
  if (!(await requirePermiso(req, 'cortadores'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const body = await req.json();
  const parsed = CortadorSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const data = parsed.data;
  const cortador = await prisma.$transaction(async (tx) => {
    const c = await tx.cortador.create({
      data: {
        nombre: data.nombre.trim(),
        contacto: data.contacto || null,
        notas: data.notas || null,
        usuarioId: data.usuarioId || null,
        predeterminado: data.predeterminado ?? false,
        tarifaDefault: data.tarifaDefault ?? null,
        tarifaModo: data.tarifaModo ?? null,
      },
    });
    if (data.predeterminado) await dejarUnicoPredeterminado(tx, c.id);
    return c;
  });
  return NextResponse.json(cortador, { status: 201 });
}
