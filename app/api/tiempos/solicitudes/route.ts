import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const Schema = z.object({
  tiempoId:     z.string().min(1),
  skuNuevo:     z.string().optional(),
  maquinaNueva: z.string().optional(),
}).refine((d) => d.skuNuevo !== undefined || d.maquinaNueva !== undefined, { message: 'Elegí qué corregir' });

// GET: admin → todas las pendientes (con el registro); costurera → sus pendientes.
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  if (session.rol === 'admin') {
    const solicitudes = await prisma.solicitudCambioTiempo.findMany({
      where: { estado: 'pendiente' },
      include: { tiempo: { select: { id: true, usuario: true, actividad: true, fecha: true, sku: true, maquina: true, minutosNetos: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(solicitudes);
  }

  const solicitudes = await prisma.solicitudCambioTiempo.findMany({
    where: { solicitadaPor: session.nombre, estado: 'pendiente' },
    select: { id: true, tiempoId: true },
  });
  return NextResponse.json(solicitudes);
}

// POST: la costurera pide corregir un registro PROPIO (sku y/o máquina).
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { tiempoId, skuNuevo, maquinaNueva } = parsed.data;

  const registro = await prisma.tiemposProduccion.findUnique({ where: { id: tiempoId } });
  if (!registro) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
  if (registro.usuario !== session.nombre) return NextResponse.json({ error: 'Ese registro no es tuyo' }, { status: 403 });

  const yaPendiente = await prisma.solicitudCambioTiempo.findFirst({ where: { tiempoId, estado: 'pendiente' } });
  if (yaPendiente) return NextResponse.json({ error: 'Ya hay una solicitud pendiente para este registro' }, { status: 400 });

  const solicitud = await prisma.solicitudCambioTiempo.create({
    data: {
      tiempoId,
      solicitadaPor: session.nombre,
      skuAnterior: registro.sku,
      maquinaAnterior: registro.maquina,
      skuNuevo: skuNuevo?.trim() || null,
      maquinaNueva: maquinaNueva?.trim() || null,
      estado: 'pendiente',
    },
  });
  return NextResponse.json(solicitud, { status: 201 });
}
