import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { CORRIDA_INCLUDE, serializar } from '@/lib/calculadora/corridaDb';

export const dynamic = 'force-dynamic';

// La corrida activa de QUIEN PIDE. Vive bajo /api/tiempos a propósito: es el
// prefijo que proxy.ts ya le permite a la costurera (rol con cero permisos).
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const corrida = await prisma.corridaMuestra.findFirst({
    where: { costurera: session.nombre, estado: { in: ['pendiente', 'en_curso'] } },
    orderBy: { createdAt: 'asc' },
    include: CORRIDA_INCLUDE,
  });

  return NextResponse.json(corrida ? serializar(corrida) : null);
}
