import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requirePermiso } from '@/lib/auth';
import { RegistrarCorteSchema } from '@/lib/validators/produccion';
import { registrarCorteOrden, revertirCorteOrden, trazarEdicion, CorteError } from '@/lib/produccion/corte';
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
  fechaCorte: z.string().optional(),
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

  // Un corte imputado a un pago SE PUEDE editar: con la cuenta corriente el saldo se mueve
  // por la diferencia. Lo único que descuadra es cambiar de cortador — la deuda se muda a
  // otra cuenta y el pago se queda en la primera — así que eso sigue pidiendo anular el pago.
  const previo = await prisma.ordenProduccion.findUnique({
    where: { id },
    select: { pagoCorteId: true, cortadorId: true, costoCorte: true, cantidad: true },
  });
  if (!previo) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });
  if (previo.pagoCorteId && (parsed.data.cortadorId ?? null) !== previo.cortadorId) {
    return NextResponse.json({ error: 'Este corte está imputado a un pago: no se puede cambiar de cortador sin anular el pago en Cuenta de cortadores.' }, { status: 400 });
  }

  try {
    // Si la ficha ya estaba cargada, es una EDICIÓN: revierte y re-registra en la misma
    // transacción (el impacto neto en rollos es la diferencia). Nada se toca si algo falla.
    const result = await prisma.$transaction(async (tx) => {
      // permitirTerminada: editar la ficha (incl. tela) aun con costura terminada.
      // Solo cambia consumo de rollos; el stock de prendas terminadas no se toca.
      // permitirImputado: el revert intermedio no se ve desde afuera (misma transacción).
      await revertirCorteOrden(tx, id, session, true, !!previo.pagoCorteId);
      const orden = await registrarCorteOrden(tx, id, parsed.data, session);
      if (previo.pagoCorteId) await trazarEdicion(tx, id, previo, orden, session.nombre);
      return orden;
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
  const { cortadorId, costoCorte, modoCosto, talles, avios, notas, fechaCorte } = parsed.data;

  const orden = await prisma.ordenProduccion.findUnique({ where: { id } });
  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });
  if (!orden.fichaCorteCargada) return NextResponse.json({ error: 'La ficha todavía no está cargada' }, { status: 400 });
  // Esta edición reescribe `costoCorte` y `cortadorId`. Con la cuenta corriente, cambiar el
  // costo es seguro (el saldo se mueve por la diferencia y queda la traza de EdicionCorte);
  // cambiar el CORTADOR no lo es: mueve la deuda a otra cuenta y deja el pago en la primera.
  if (orden.pagoCorteId && (cortadorId ?? null) !== orden.cortadorId) {
    return NextResponse.json({ error: 'Este corte está imputado a un pago: no se puede cambiar de cortador sin anular el pago en Cuenta de cortadores.' }, { status: 400 });
  }

  const cortador = cortadorId ? await prisma.cortador.findUnique({ where: { id: cortadorId } }) : null;
  if (cortadorId && !cortador) return NextResponse.json({ error: 'Cortador no encontrado' }, { status: 400 });

  const cantidad = talles.reduce((s, t) => s + t.cantidad, 0);
  if (cantidad <= 0) return NextResponse.json({ error: 'Cargá al menos un talle con cantidad' }, { status: 400 });
  const costoCorteTotal = (modoCosto === 'unidad' ? (costoCorte ?? 0) * cantidad : (costoCorte ?? 0));
  // La edición rápida no toca tela ni sublimación, pero recompone costoTotal a mano: si no
  // se arrastran, cambiar un talle o el cortador los borraría del total.
  const costoTotal = Number(orden.costoTela) + Number(orden.costoSublimacion) + costoCorteTotal;

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
    ...(fechaCorte ? { fechaCorte } : {}),
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
        ...(fechaCorte ? { fechaCorte: new Date(`${fechaCorte}T12:00:00Z`) } : {}),
        ...(notas?.trim() ? { notas: (orden.notas ? orden.notas + '\n' : '') + `[Corte] ${notas.trim()}` } : {}),
      },
    });
    if (orden.pagoCorteId) {
      await trazarEdicion(tx, id, orden, { costoCorte: costoCorteTotal, cantidad }, session.nombre);
    }
  });

  return NextResponse.json({ ok: true });
}
