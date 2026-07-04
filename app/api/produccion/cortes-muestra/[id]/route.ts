import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { z } from 'zod';

type Ctx = { params: Promise<{ id: string }> };
const Schema = z.object({ estado: z.enum(['pendiente', 'validado']) });

// Validar / desvalidar una muestra del cortador. Validada = queda cobrable (entra a Pagos).
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'estado inválido' }, { status: 400 });

  const m = await prisma.corteMuestra.findUnique({ where: { id }, select: { pagoCorteId: true } });
  if (!m) return NextResponse.json({ error: 'Muestra no encontrada' }, { status: 404 });
  if (m.pagoCorteId) return NextResponse.json({ error: 'La muestra ya está pagada' }, { status: 400 });

  const muestra = await prisma.corteMuestra.update({ where: { id }, data: { estado: parsed.data.estado } });
  return NextResponse.json(muestra);
}
