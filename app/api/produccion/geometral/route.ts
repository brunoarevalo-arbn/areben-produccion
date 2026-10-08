import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAlguno } from '@/lib/auth';

// Guarda (o borra, con `url: null`) el geometral de un color (`ordenId`) o del modelo
// (`loteId`, el LoteProduccion). La imagen ya está subida a Blob por /api/upload-imagen.
// Lo sube la diseñadora, por eso alcanza con `diseno` además de `produccion`.
export async function PUT(req: NextRequest) {
  const session = await requireAlguno(req, ['produccion', 'diseno']);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const body = await req.json().catch(() => null) as { ordenId?: string; loteId?: string; url?: string | null } | null;
  const url = body?.url ?? null;
  if (!body || (!body.ordenId === !body.loteId)) return NextResponse.json({ error: 'Indicá el color o el modelo' }, { status: 400 });
  if (url !== null && (typeof url !== 'string' || !url.startsWith('https://'))) {
    return NextResponse.json({ error: 'La imagen tiene que ser una dirección https' }, { status: 400 });
  }

  try {
    if (body.ordenId) await prisma.ordenProduccion.update({ where: { id: body.ordenId }, data: { geometralUrl: url } });
    else await prisma.loteProduccion.update({ where: { id: body.loteId! }, data: { geometralUrl: url } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'No existe esa orden o ese modelo' }, { status: 404 });
  }
}
