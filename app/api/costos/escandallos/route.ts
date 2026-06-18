import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { requirePermiso } from '@/lib/auth';
import { aplicarDescuentoAviosDesdeEscandallo } from '@/lib/costos/aviosStock';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySession(token))) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });
  const escandallos = await prisma.escandallo.findMany({ orderBy: { updatedAt: 'desc' } });
  return NextResponse.json(escandallos);
}

export async function POST(req: NextRequest) {
  if (!await requirePermiso(req, 'costos')) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { nombre, sku, marca, tipoPrenda, proyectoId, notas, datos } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  const escandallo = await prisma.escandallo.create({
    data: {
      nombre:     nombre.trim(),
      sku:        sku?.trim()        || null,
      marca:      marca?.trim()      || null,
      tipoPrenda: tipoPrenda?.trim() || null,
      proyectoId: proyectoId         || null,
      notas:      notas?.trim()      || null,
      datos:      datos ? JSON.stringify(datos) : null,
    },
  });
  // Si hay órdenes terminadas de este SKU sin avíos descontados, descuenta ahora.
  try { await aplicarDescuentoAviosDesdeEscandallo(escandallo.sku, datos); } catch { /* no romper el guardado */ }
  return NextResponse.json(escandallo, { status: 201 });
}
