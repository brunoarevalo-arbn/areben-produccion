import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { z } from 'zod';

// Tiempos de estampado: una tanda = cantidad de estampas aplicadas + minutos totales.
const Schema = z.object({
  cantidad:     z.number().int().min(1, 'Cargá cuántas estampas hiciste'),
  minutosNetos: z.number().min(0).default(0),
  horaInicio:   z.string().optional(),
  horaFin:      z.string().optional(),
  notas:        z.string().optional(),
});

const horaASegundos = (h: string) => {
  const [hh, mm, ss] = h.split(':').map(Number);
  return (hh || 0) * 3600 + (mm || 0) * 60 + (ss || 0);
};

// GET: tandas del usuario (por defecto, del día) — para la lista de la tablet.
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });
  const url = new URL(req.url);
  const usuario = url.searchParams.get('usuario') ?? session.nombre;
  const fecha = url.searchParams.get('fecha') ?? new Date().toISOString().split('T')[0];
  const tandas = await prisma.tiemposEstampado.findMany({
    where: { usuario, fecha },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(tandas);
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  // Si no vienen minutos pero sí horario, derivar.
  let minutos = d.minutosNetos;
  if (!minutos && d.horaInicio && d.horaFin) {
    const segs = horaASegundos(d.horaFin) - horaASegundos(d.horaInicio);
    minutos = segs > 0 ? Math.floor(segs / 60) : 0;
  }

  const tanda = await prisma.tiemposEstampado.create({
    data: {
      usuario: session.nombre,
      fecha: new Date().toISOString().split('T')[0],
      cantidad: d.cantidad,
      minutosNetos: minutos,
      horaInicio: d.horaInicio ?? null,
      horaFin: d.horaFin ?? null,
      notas: d.notas?.trim() || null,
      estado: 'guardado',
    },
  });
  return NextResponse.json(tanda, { status: 201 });
}
