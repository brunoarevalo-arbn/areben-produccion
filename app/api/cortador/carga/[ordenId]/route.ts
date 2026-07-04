import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { z } from 'zod';

type Ctx = { params: Promise<{ ordenId: string }> };

// Carga del cortador: tizadas (sin rollos), talles, precio y fecha. NO toca stock —
// queda 'cargado' para que la diseñadora asigne el rollo y valide (recién ahí se
// descuenta stock y entra a pagos de cortes).
const Schema = z.object({
  tizadas: z.array(z.object({ nombre: z.string().default(''), metros: z.string().default(''), unidades: z.string().default('1') })).min(1),
  talles:  z.array(z.object({ talle: z.string().min(1), cantidad: z.number().int().min(0) })).min(1),
  costoCorte: z.number().min(0).optional(),
  modoCosto:  z.enum(['total', 'unidad']).default('total'),
  fechaCorte: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'cortador');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { ordenId } = await params;

  const cortador = await prisma.cortador.findFirst({ where: { usuarioId: session.id } });
  if (!cortador) return NextResponse.json({ error: 'Tu usuario no está vinculado a un cortador' }, { status: 400 });

  const orden = await prisma.ordenProduccion.findUnique({ where: { id: ordenId } });
  if (!orden || orden.cortadorId !== cortador.id) return NextResponse.json({ error: 'Ese corte no está asignado a vos' }, { status: 403 });
  if (orden.fichaCorteCargada) return NextResponse.json({ error: 'Este corte ya fue procesado por el taller' }, { status: 400 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { tizadas, talles, costoCorte, modoCosto, fechaCorte } = parsed.data;

  const cantidad = talles.reduce((s, t) => s + t.cantidad, 0);
  if (cantidad <= 0) return NextResponse.json({ error: 'Cargá al menos un talle con cantidad' }, { status: 400 });

  // Se guarda como fichaCorteData (mismo formato del form) con rollos vacíos: la
  // diseñadora los completa al asignar la tela.
  const fichaCorteData = {
    tizadas: tizadas.map((t, i) => ({ id: `t${i + 1}`, nombre: t.nombre, modo: 'tizada' as const, metros: t.metros, unidades: t.unidades, rollos: [] })),
    talles: Object.fromEntries(talles.filter((t) => t.cantidad > 0).map((t) => [t.talle, String(t.cantidad)])),
    avios: [],
    cortadorId: cortador.id,
    costoCorte: costoCorte ?? 0,
    modoCosto,
    fechaCorte,
  };

  await prisma.ordenProduccion.update({
    where: { id: ordenId },
    data: { fichaCorteData, corteEstado: 'cargado', cantidad },
  });

  return NextResponse.json({ ok: true });
}
