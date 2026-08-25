import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { salidasPendientes, periodoDe } from '@/lib/costos/pasaje';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

// GET: las salidas de producto terminado todavía sin pasaje, valorizadas, + los pasajes ya
// cerrados. POST: cierra el pasaje de una marca (sella los movimientos, congela el costo).
export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'costos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const [pendientes, cerrados] = await Promise.all([
    salidasPendientes(),
    prisma.pasaje.findMany({ orderBy: { createdAt: 'desc' }, take: 24, include: { _count: { select: { items: true } } } }),
  ]);

  return NextResponse.json({
    pendientes,
    cerrados: cerrados.map((p) => ({
      id: p.id, marca: p.marca, periodo: p.periodo,
      desde: p.desde, hasta: p.hasta,
      unidades: p.unidades, totalNeto: Number(p.totalNeto),
      items: p._count.items, notas: p.notas, creadoPor: p.creadoPor, createdAt: p.createdAt,
    })),
  });
}

const CerrarSchema = z.object({
  marca: z.string().trim().min(1, 'Elegí la marca'),
  notas: z.string().trim().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'costos');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const parsed = CerrarSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  // Se recalcula acá, no se confía en lo que mandó la pantalla: entre que se dibujó y se
  // apretó el botón pudo entrar una salida nueva o costearse un SKU.
  const grupos = await salidasPendientes();
  const g = grupos.find((x) => x.marca === parsed.data.marca);
  if (!g) return NextResponse.json({ error: 'No hay salidas pendientes de esa marca' }, { status: 400 });
  if (g.sinCosto.length > 0) {
    return NextResponse.json({ error: `Faltan costear ${g.sinCosto.length} línea(s): el total quedaría incompleto.` }, { status: 400 });
  }
  if (g.costeadas.length === 0) return NextResponse.json({ error: 'No hay nada para pasar' }, { status: 400 });

  const movimientoIds = g.costeadas.flatMap((f) => f.movimientoIds);

  const pasaje = await prisma.$transaction(async (tx) => {
    const p = await tx.pasaje.create({
      data: {
        marca: g.marca!,
        periodo: periodoDe(g.hasta!),
        desde: g.desde!, hasta: g.hasta!,
        unidades: g.unidades,
        totalNeto: new Prisma.Decimal(g.totalNeto.toFixed(2)),
        notas: parsed.data.notas || null,
        creadoPor: session.nombre,
        items: {
          create: g.costeadas.map((f) => ({
            sku: f.sku, talle: f.talle, tipo: f.tipo, cantidad: f.cantidad,
            costoUnitario: new Prisma.Decimal(f.costoUnitario!.toFixed(4)),
            costoTotal: new Prisma.Decimal(f.costoTotal!.toFixed(2)),
          })),
        },
      },
    });
    // El sello: `pasajeId: null` en el WHERE hace que dos cierres simultáneos no puedan
    // llevarse el mismo movimiento — el segundo actualiza 0 filas y se cae la transacción.
    const sellados = await tx.movimientoTerminado.updateMany({
      where: { id: { in: movimientoIds }, pasajeId: null },
      data: { pasajeId: p.id },
    });
    if (sellados.count !== movimientoIds.length) {
      throw new Error('Alguien cerró un pasaje con estas mismas salidas mientras cerrabas este. Volvé a mirar la pantalla.');
    }
    return p;
  });

  return NextResponse.json({ id: pasaje.id }, { status: 201 });
}
