import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { z } from 'zod';

const Schema = z.object({ accion: z.enum(['aprobar', 'rechazar']) });

type Ctx = { params: Promise<{ id: string }> };

// Aprobar/rechazar una solicitud (solo admin). Al aprobar, aplica el cambio al registro.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
  const { id } = await params;

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });

  const sol = await prisma.solicitudCambioTiempo.findUnique({ where: { id } });
  if (!sol) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
  if (sol.estado !== 'pendiente') return NextResponse.json({ error: 'La solicitud ya fue resuelta' }, { status: 400 });

  if (parsed.data.accion === 'rechazar') {
    await prisma.solicitudCambioTiempo.update({
      where: { id },
      data: { estado: 'rechazada', resueltaPor: session.nombre, resueltaAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  // Aprobar: aplicar solo los campos pedidos.
  const cambios: Record<string, unknown> = {};
  if (sol.skuNuevo !== null) cambios.sku = sol.skuNuevo;
  if (sol.maquinaNueva !== null) cambios.maquina = sol.maquinaNueva;

  await prisma.$transaction([
    prisma.tiemposProduccion.update({ where: { id: sol.tiempoId }, data: cambios }),
    prisma.solicitudCambioTiempo.update({
      where: { id },
      data: { estado: 'aprobada', resueltaPor: session.nombre, resueltaAt: new Date() },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
