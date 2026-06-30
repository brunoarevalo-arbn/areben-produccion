import { NextRequest, NextResponse } from 'next/server';
import { requirePermiso } from '@/lib/auth';
import { buscarProductosPropios, GestionNubeError } from '@/lib/gestionnube/client';

// Busca productos de producción propia (Zattia/Areben/Stunned) en Gestión Nube por nombre/código,
// para vincularlos a un liso desde el administrador de mapeo.
export async function GET(req: NextRequest) {
  const session = await requirePermiso(req, 'reposicion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const q = new URL(req.url).searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  try {
    return NextResponse.json(await buscarProductosPropios(q));
  } catch (e) {
    if (e instanceof GestionNubeError) return NextResponse.json({ error: e.message }, { status: 502 });
    throw e;
  }
}
