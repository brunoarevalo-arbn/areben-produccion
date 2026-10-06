import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { activarSeparacion, LotePlanificadoError } from '@/lib/produccion/lotesPlanificados';

type Ctx = { params: Promise<{ id: string }> };

// Acción acotada para la tablet de costura: la costurera confirma que terminó el proceso
// (p. ej. el remallado) y se activa la separación en lotes que el taller dejó programada.
// Como el aviso de "terminé" (../route.ts), la puede hacer cualquier sesión: es la tablet.
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });
  const { id } = await params;
  try {
    await prisma.$transaction((tx) => activarSeparacion(tx, id, session, 'tablet'));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof LotePlanificadoError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
