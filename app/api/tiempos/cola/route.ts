import { NextResponse } from 'next/server';
import { colaTablet } from '@/lib/produccion/colaTablet';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const filas = await colaTablet();
    return NextResponse.json(filas);
  } catch (err) {
    console.error('[tiempos/cola GET]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
