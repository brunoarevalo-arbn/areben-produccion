import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { TerminarCosturaSchema } from '@/lib/validators/produccion';

type Ctx = { params: Promise<{ id: string }> };

// Termina la costura: se cuenta lo que salió por talle y eso ingresa al stock de
// lisos terminados (por SKU + talle). La OP pasa a TERMINADO_SIN_ESTAMPA.
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const parsed = TerminarCosturaSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const orden = await prisma.ordenProduccion.findUnique({ where: { id } });
  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });
  if (orden.estado !== 'COSTURA') {
    return NextResponse.json({ error: 'Solo se termina la costura desde el estado COSTURA' }, { status: 400 });
  }
  if (!orden.sku?.trim()) {
    return NextResponse.json({ error: 'La OP no tiene SKU asignado' }, { status: 400 });
  }

  const sku = orden.sku.trim();
  const talles = parsed.data.talles.filter((t) => t.cantidad > 0);
  if (talles.length === 0) {
    return NextResponse.json({ error: 'Cargá la cantidad que salió de al menos un talle' }, { status: 400 });
  }
  const totalProducido = talles.reduce((s, t) => s + t.cantidad, 0);

  await prisma.$transaction(async (tx) => {
    for (const t of talles) {
      await tx.stockTerminado.upsert({
        where:  { sku_talle_tipo: { sku, talle: t.talle, tipo: 'liso' } },
        create: { sku, talle: t.talle, tipo: 'liso', cantidad: t.cantidad },
        update: { cantidad: { increment: t.cantidad } },
      });
      await tx.movimientoTerminado.create({
        data: {
          sku, talle: t.talle, tipo: 'liso',
          cantidad: t.cantidad,
          origen: 'produccion',
          ordenId: id,
          motivo: 'Costura terminada',
          creadoPor: session.nombre,
        },
      });
    }

    await tx.ordenProduccion.update({
      where: { id },
      data: { estado: 'TERMINADO_SIN_ESTAMPA', terminadoAt: new Date(), cantidad: totalProducido },
    });
    await tx.estadoTransicion.create({
      data: {
        ordenId: id,
        estadoAnterior: 'COSTURA',
        estadoNuevo: 'TERMINADO_SIN_ESTAMPA',
        usuarioId: session.id,
        notas: `Costura terminada: ${totalProducido} u (${talles.map((t) => `${t.talle}:${t.cantidad}`).join(', ')}) → stock`,
      },
    });
  });

  return NextResponse.json({ ok: true, total: totalProducido }, { status: 201 });
}
