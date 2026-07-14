import { NextRequest, NextResponse } from 'next/server';
import { requirePermiso } from '@/lib/auth';
import { construirFilasPrecios } from '@/lib/costos/preciosData';

export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'precios'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const data = await construirFilasPrecios();
  return NextResponse.json(data);
}
