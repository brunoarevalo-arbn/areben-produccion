import { NextRequest, NextResponse } from 'next/server';
import { requireAlguno } from '@/lib/auth';
import { conjuntosActivos } from '@/lib/produccion/conjuntos';

// Las piezas en las que puede ir un avío de UNA sola pieza (el dije: 'Bombacha'). Salen
// del catálogo de conjuntos y ⛔ se tipean: un nombre que no coincide letra por letra con
// la parte no iría en ninguna, y el ingreso se plantaría por eso.
export async function GET(req: NextRequest) {
  if (!(await requireAlguno(req, ['costos', 'insumos']))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const partes = new Set<string>();
  for (const c of (await conjuntosActivos()).values()) for (const p of c.partes) partes.add(p.nombre);
  return NextResponse.json([...partes]);
}
