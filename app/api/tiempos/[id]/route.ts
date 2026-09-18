import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { sincronizarGastoDeMuestra } from '@/lib/tiempos/registrar';
import { minutosEntre } from '@/lib/tiempos/minutos';

const PatchSchema = z.object({
  actividad:          z.string().min(1).optional(),
  horaInicio:         z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  horaFin:            z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  cantidad:           z.number().int().nonnegative().optional(),
  defectos:           z.number().int().nonnegative().optional(),
  sku:                z.string().nullable().optional(),
  parte:              z.string().max(40).nullable().optional(),
  maquina:            z.string().nullable().optional(),
  inconveniente:      z.string().nullable().optional(),
  inconvenienteNotas: z.string().nullable().optional(),
});

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

  // Los minutos se recalculan SÓLO si una hora efectivamente CAMBIÓ.
  //
  // 🔴 Antes alcanzaba con que la hora VINIERA en el PATCH, aunque fuera igual: el
  // formulario las manda siempre, así que corregir sólo la máquina le pisaba los
  // minutos MEDIDOS por el cronómetro con un valor DERIVADO de las horas. Con el
  // truncado de `Math.floor` encima, el registro de la verde del 18-sep pasó de
  // 41,37 a 41 min al corregirle la máquina. Un dato medido ⛔ no se pisa con uno
  // derivado, y menos sin que nadie lo haya pedido.
  const horaInicio = parsed.data.horaInicio ?? actual.horaInicio;
  const horaFin    = parsed.data.horaFin    ?? actual.horaFin;
  const cambioHora =
    (parsed.data.horaInicio !== undefined && parsed.data.horaInicio !== actual.horaInicio) ||
    (parsed.data.horaFin    !== undefined && parsed.data.horaFin    !== actual.horaFin);
  if (cambioHora && horaInicio && horaFin) {
    data.minutosNetos = minutosEntre(horaInicio, horaFin);
  }

  const actualizado = await prisma.tiemposProduccion.update({ where: { id }, data });

  // El gasto de la muestra sigue al registro: si acá cambian los minutos, la
  // actividad o el sku, la plata tiene que cambiar con ellos.
  await sincronizarGastoDeMuestra(id);

  return NextResponse.json(actualizado);
}
