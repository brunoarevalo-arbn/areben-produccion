import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { cargarCorrida, cerrarYAbrir, serializar } from '@/lib/calculadora/corridaDb';

const TerminarSchema = z.object({
  minutos: z.number().min(0).max(600).optional(),
  horaFin: z.string().optional(),
});

// Cierra la corrida. Cierra primero el tramo que pudiera estar corriendo, para
// que no quede un tramo abierto para siempre falseando el total.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const corrida = await cargarCorrida(id);
  if (!corrida) return NextResponse.json({ error: 'No existe' }, { status: 404 });
  if (corrida.costurera !== session.nombre && session.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }
  if (corrida.estado === 'terminada') return NextResponse.json(serializar(corrida));

  const parsed = TerminarSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  await cerrarYAbrir(id, { minutos: parsed.data.minutos ?? 0, horaFin: parsed.data.horaFin, siguiente: null });
  await prisma.corridaMuestra.update({
    where: { id },
    data: { estado: 'terminada', terminadaAt: new Date() },
  });

  const fresca = await cargarCorrida(id);
  return NextResponse.json(serializar(fresca!));
}
