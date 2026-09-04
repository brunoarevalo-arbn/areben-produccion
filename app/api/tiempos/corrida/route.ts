import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { corridasAbiertasDe } from '@/lib/calculadora/corridaDb';

export const dynamic = 'force-dynamic';

// TODAS las corridas abiertas de QUIEN PIDE, no la primera. Vive bajo
// /api/tiempos a propósito: es el prefijo que proxy.ts ya le permite a la
// costurera (rol con cero permisos).
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  return NextResponse.json(await corridasAbiertasDe(session));
}
