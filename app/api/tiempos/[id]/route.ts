import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

const PatchSchema = z.object({
  actividad:  z.string().min(1).optional(),
  horaInicio: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  horaFin:    z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  cantidad:   z.number().int().nonnegative().optional(),
  defectos:   z.number().int().nonnegative().optional(),
  sku:        z.string().nullable().optional(),
  maquina:    z.string().nullable().optional(),
});

function horaASegundos(h: string): number {
  const [hh, mm, ss = '0'] = h.split(':');
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const actual = await prisma.tiemposProduccion.findUnique({ where: { id } });
  if (!actual) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });

  const data: Record<string, unknown> = { ...parsed.data };

  // Si cambian horas, recalcular minutosNetos
  const horaInicio = parsed.data.horaInicio ?? actual.horaInicio;
  const horaFin    = parsed.data.horaFin    ?? actual.horaFin;
  if ((parsed.data.horaInicio || parsed.data.horaFin) && horaInicio && horaFin) {
    const segs = horaASegundos(horaFin) - horaASegundos(horaInicio);
    data.minutosNetos = segs > 0 ? Math.floor(segs / 60) : 0;
  }

  const actualizado = await prisma.tiemposProduccion.update({ where: { id }, data });
  return NextResponse.json(actualizado);
}
