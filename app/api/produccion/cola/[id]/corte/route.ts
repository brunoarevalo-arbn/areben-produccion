import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requirePermiso } from '@/lib/auth';
import { RegistrarCorteSchema } from '@/lib/validators/produccion';
import { registrarCorteOrden, revertirCorteOrden, CorteError } from '@/lib/produccion/corte';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

type Ctx = { params: Promise<{ id: string }> };

// Edición rápida: solo campos que NO mueven stock (cortador, costo de corte, talles,
// avíos, notas). No toca rollos ni consumo → no hace falta revertir.
const EdicionRapidaSchema = z.object({
  cortadorId: z.string().nullable().optional(),
  costoCorte: z.number().min(0).optional(),
  modoCosto:  z.enum(['total', 'unidad']).default('total'),
  talles:     z.array(z.object({ talle: z.string().min(1), cantidad: z.number().int().min(0) })).min(1),
  avios:      z.array(z.object({ etiquetaId: z.string().min(1), cantidad: z.number().int().positive() })).default([]),
  notas:      z.string().optional(),
});

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const orden = await prisma.ordenProduccion.findUnique({
    where: { id },
    include: {
      cortesPorTalle: { orderBy: { talle: 'asc' } },
      avios: { select: { etiquetaId: true, cantidad: true } },
      movimientosInsumo: {
        include: {
          rollo: { include: { insumo: { select: { nombre: true, rinde: true } }, color: { select: { nombre: true } } } },
          lote: { include: { insumo: { select: { nombre: true } }, color: { select: { nombre: true } } } },
        },
        orderBy: { fecha: 'desc' },
      },
    },
  });

  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });
  return NextResponse.json(orden);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const parsed = RegistrarCorteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    // Si la ficha ya estaba cargada, es una EDICIÓN: revierte y re-registra en la misma
    // transacción (el impacto neto en rollos es la diferencia). Nada se toca si algo falla.
    const result = await prisma.$transaction(async (tx) => {
      await revertirCorteOrden(tx, id, session);
      return registrarCorteOrden(tx, id, parsed.data, session);
    }, { timeout: 30000, maxWait: 15000 });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof CorteError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

// Edición rápida: cortador, costo de corte, talles, avíos, notas. NO toca rollos/consumo.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const parsed = EdicionRapidaSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { cortadorId, costoCorte, modoCosto, talles, avios, notas } = parsed.data;

  const orden = await prisma.ordenProduccion.findUnique({ where: { id } });
  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });
  if (!orden.fichaCorteCargada) return NextResponse.json({ error: 'La ficha todavía no está cargada' }, { status: 400 });

  const cortador = cortadorId ? await prisma.cortador.findUnique({ where: { id: cortadorId } }) : null;
  if (cortadorId && !cortador) return NextResponse.json({ error: 'Cortador no encontrado' }, { status: 400 });

  const cantidad = talles.reduce((s, t) => s + t.cantidad, 0);
  if (cantidad <= 0) return NextResponse.json({ error: 'Cargá al menos un talle con cantidad' }, { status: 400 });
  const costoCorteTotal = (modoCosto === 'unidad' ? (costoCorte ?? 0) * cantidad : (costoCorte ?? 0));
  const costoTotal = Number(orden.costoTela) + costoCorteTotal;

  // Nombres de avíos para dejar el fichaCorteData consistente (la vista los muestra).
  const etqs = avios.length ? await prisma.etiquetaCatalogo.findMany({ where: { id: { in: avios.map((a) => a.etiquetaId) } }, select: { id: true, nombre: true } }) : [];
  const nombreEtq = new Map(etqs.map((e) => [e.id, e.nombre]));

  const fdActual = (orden.fichaCorteData as Record<string, unknown> | null) ?? null;
  const fichaData = fdActual ? {
    ...fdActual,
    talles: Object.fromEntries(talles.map((t) => [t.talle, String(t.cantidad)])),
    avios: avios.map((a) => ({ etiquetaId: a.etiquetaId, cantidad: a.cantidad, nombre: nombreEtq.get(a.etiquetaId) })),
    cortadorId: cortadorId ?? null,
    costoCorte: costoCorte ?? 0,
    modoCosto,
  } : Prisma.JsonNull;

  await prisma.$transaction(async (tx) => {
    await tx.cortePorTalle.deleteMany({ where: { ordenId: id } });
    await tx.cortePorTalle.createMany({ data: talles.filter((t) => t.cantidad > 0).map((t) => ({ ordenId: id, talle: t.talle, cantidad: t.cantidad })) });
    await tx.ordenAvio.deleteMany({ where: { ordenId: id } });
    if (avios.length) await tx.ordenAvio.createMany({ data: avios.map((a) => ({ ordenId: id, etiquetaId: a.etiquetaId, cantidad: a.cantidad, origen: 'corte' })) });
    await tx.ordenProduccion.update({
      where: { id },
      data: {
        cortador: cortador?.nombre ?? null,
        cortadorId: cortadorId ?? null,
        costoCorte: new Prisma.Decimal(costoCorteTotal),
        costoTotal: new Prisma.Decimal(costoTotal),
        cantidad,
        fichaCorteData: fichaData,
        ...(notas?.trim() ? { notas: (orden.notas ? orden.notas + '\n' : '') + `[Corte] ${notas.trim()}` } : {}),
      },
    });
  });

  return NextResponse.json({ ok: true });
}
