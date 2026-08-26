import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { cargarCorrida, serializar } from '@/lib/calculadora/corridaDb';

// Un corte del tubo, en el orden en que salió de la cortacollaretas.
// `ribeteId: null` = DESPERDICIO (vino una unión y no puede pasar).
const CorteSchema = z.object({
  ribeteId: z.string().trim().nullable(),
  unidad: z.number().int().min(1).max(50),
  largoCm: z.number().min(0.1, 'Cargá los centímetros').max(2000),
});

async function corridaDe(req: NextRequest, id: string) {
  const session = await getSession(req);
  if (!session) return { error: NextResponse.json({ error: 'Sin acceso' }, { status: 401 }) };
  const corrida = await cargarCorrida(id);
  if (!corrida) return { error: NextResponse.json({ error: 'No existe' }, { status: 404 }) };
  // El nombre sale de la SESIÓN, nunca del body.
  if (corrida.costurera !== session.nombre && session.rol !== 'admin') {
    return { error: NextResponse.json({ error: 'Sin acceso' }, { status: 403 }) };
  }
  return { corrida };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { corrida, error } = await corridaDe(req, id);
  if (error) return error;

  const parsed = CorteSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  // El ribete tiene que ser de ESTA corrida: si no, un corte quedaría colgado de
  // la definición de otra prenda y su largo por prenda saldría inflado.
  if (d.ribeteId && !corrida!.ribetes.some((r) => r.id === d.ribeteId)) {
    return NextResponse.json({ error: 'Ese ribete no es de esta corrida' }, { status: 400 });
  }

  const orden = corrida!.cortes.reduce((max, c) => Math.max(max, c.orden), -1) + 1;
  await prisma.corridaCorteTubo.create({
    data: { corridaId: id, ribeteId: d.ribeteId, unidad: d.unidad, orden, largoCm: d.largoCm },
  });

  const fresca = await cargarCorrida(id);
  return NextResponse.json(serializar(fresca!));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { corrida, error } = await corridaDe(req, id);
  if (error) return error;

  const corteId = req.nextUrl.searchParams.get('corteId');
  if (!corteId || !corrida!.cortes.some((c) => c.id === corteId)) {
    return NextResponse.json({ error: 'Ese corte no es de esta corrida' }, { status: 400 });
  }
  await prisma.corridaCorteTubo.delete({ where: { id: corteId } });

  const fresca = await cargarCorrida(id);
  return NextResponse.json(serializar(fresca!));
}
