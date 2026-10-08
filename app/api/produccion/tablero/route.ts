import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { can, getPermisos, requirePermiso } from '@/lib/auth';
import { cargarTablero } from '@/lib/produccion/tablero';

// El tablero de Producción › Órdenes. Los montos sólo viajan con el permiso `costos`:
// la diseñadora ve avance, tiempos y lotes, nunca plata (Bruno, 8-oct).
export async function GET(req: NextRequest) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  try {
    const conValores = can(await getPermisos(session), 'costos');
    return NextResponse.json(await cargarTablero(prisma, { conValores }));
  } catch (err) {
    console.error('[tablero GET]', err);
    return NextResponse.json({ error: 'No se pudo cargar el tablero' }, { status: 500 });
  }
}
