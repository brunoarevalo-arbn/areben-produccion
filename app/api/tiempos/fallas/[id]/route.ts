import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { FallaSchema } from '@/lib/validators/fallas';
import { registrarFalla, contextoFallas, LotePlanificadoError } from '@/lib/produccion/lotesPlanificados';

type Ctx = { params: Promise<{ id: string }> };

// La tablet reporta una pieza fallada (Bruno, 8-oct: «que pueda cargar o reportar falla,
// o si no nosotros»). Mismo núcleo que la falla cargada desde Órdenes: queda registrada con
// el nombre de la costurera y el taller la ve —y la borra si está mal— en Órdenes / la OP.
// ⛔ Borrar es sólo de producción: desde acá no.
// `getSession` acepta a la costurera a propósito (es su tablet); `proxy.ts` la confina a /api/tiempos.
export async function GET(req: NextRequest, { params }: Ctx) {
  if (!(await getSession(req))) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });
  const { id } = await params;
  const orden = await prisma.ordenProduccion.findUnique({ where: { id }, include: { cortesPorTalle: true } });
  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });
  return NextResponse.json(await contextoFallas(prisma, orden));
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });
  const { id } = await params;
  const parsed = FallaSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try {
    const ctx = await prisma.$transaction((tx) => registrarFalla(tx, id, parsed.data, session));
    return NextResponse.json(ctx, { status: 201 });
  } catch (e) {
    if (e instanceof LotePlanificadoError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
