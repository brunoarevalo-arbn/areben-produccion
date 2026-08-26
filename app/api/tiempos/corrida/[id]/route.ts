import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { cargarCorrida, serializar } from '@/lib/calculadora/corridaDb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const corrida = await cargarCorrida(id);
  if (!corrida) return NextResponse.json({ error: 'No existe' }, { status: 404 });
  // La costurera sólo ve la suya. El nombre sale de la SESIÓN, nunca del body.
  if (corrida.costurera !== session.nombre && session.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  return NextResponse.json(serializar(corrida));
}
