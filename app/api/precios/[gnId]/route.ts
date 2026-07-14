import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

type Ctx = { params: Promise<{ gnId: string }> };

// Guarda (o limpia) el override manual del PVP y/o el costo de un producto GN.
// Solo toca los campos presentes en el body (null limpia el override, vuelve al valor de GN/escandallo).
const parseOverride = (v: unknown): { ok: boolean; val: number | null } => {
  if (v == null || v === '') return { ok: true, val: null };
  const n = Number(v);
  return { ok: Number.isFinite(n) && n >= 0, val: n };
};

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'costos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const gnId = Number((await params).gnId);
  if (!Number.isFinite(gnId)) return NextResponse.json({ error: 'gnId inválido' }, { status: 400 });
  const body = await req.json();
  const data: { pvpManual?: number | null; costoManual?: number | null } = {};
  if ('pvpManual' in body) {
    const { ok, val } = parseOverride(body.pvpManual);
    if (!ok) return NextResponse.json({ error: 'PVP inválido' }, { status: 400 });
    data.pvpManual = val;
  }
  if ('costoManual' in body) {
    const { ok, val } = parseOverride(body.costoManual);
    if (!ok) return NextResponse.json({ error: 'Costo inválido' }, { status: 400 });
    data.costoManual = val;
  }
  const row = await prisma.precioProducto.upsert({
    where:  { gnId },
    create: { gnId, ...data },
    update: data,
  });
  return NextResponse.json(row);
}
