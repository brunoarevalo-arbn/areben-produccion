import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { z } from 'zod';
import { nombreItemOrden } from '@/lib/produccion/ordenEstampa';

type Ctx = { params: Promise<{ id: string }> };

// Confirma cantidades estampadas por ítem (valor absoluto). El delta descuenta (o repone)
// el liso correspondiente. El estado de la orden se deriva: pendiente/parcial/hecha.
const PatchSchema = z.object({
  items: z.array(z.object({ id: z.string().min(1), confirmado: z.number().int().min(0) })).min(1),
});

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'reposicion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const orden = await prisma.ordenEstampa.findUnique({ where: { id }, include: { items: { include: { estampa: true } } } });
  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  const byId = new Map(orden.items.map((i) => [i.id, i]));

  await prisma.$transaction(async (tx) => {
    for (const c of parsed.data.items) {
      const it = byId.get(c.id);
      if (!it) continue;
      const nuevo = Math.min(Math.max(0, c.confirmado), it.cantidad);
      const delta = nuevo - it.confirmado; // >0 confirma, <0 repone
      if (delta === 0) continue;
      // Solo estampa descuenta liso (se consume al estampar). Producción directa es
      // informativa: se registra cuánto se produjo, sin tocar stock de liso.
      if (orden.tipo === 'estampa') {
        const st = await tx.stockTerminado.findUnique({ where: { sku_talle_tipo: { sku: it.skuLiso, talle: it.talle, tipo: 'liso' } } });
        const nuevoStock = Math.max(0, (st?.cantidad ?? 0) - delta);
        await tx.stockTerminado.upsert({
          where:  { sku_talle_tipo: { sku: it.skuLiso, talle: it.talle, tipo: 'liso' } },
          create: { sku: it.skuLiso, talle: it.talle, tipo: 'liso', cantidad: nuevoStock },
          update: { cantidad: nuevoStock },
        });
        await tx.movimientoTerminado.create({
          data: { sku: it.skuLiso, talle: it.talle, tipo: 'liso', cantidad: -delta, origen: 'estampa', ordenId: id, motivo: `Estampa ${nombreItemOrden(it)}`, creadoPor: session.nombre },
        });
      }
      await tx.ordenEstampaItem.update({ where: { id: it.id }, data: { confirmado: nuevo } });
      it.confirmado = nuevo;
    }
    // Derivar estado de la orden.
    const items = await tx.ordenEstampaItem.findMany({ where: { ordenId: id } });
    const totalConf = items.reduce((s, i) => s + i.confirmado, 0);
    const totalPed = items.reduce((s, i) => s + i.cantidad, 0);
    const estado = totalConf >= totalPed ? 'hecha' : totalConf > 0 ? 'parcial' : 'pendiente';
    await tx.ordenEstampa.update({ where: { id }, data: { estado } });
    // Orden de lanzamiento completa = el DTF ya está en la mano: cierra el ciclo de la estampa.
    if (estado === 'hecha' && orden.origen === 'lanzamiento') {
      const estampaIds = [...new Set(items.map((i) => i.estampaId).filter((x): x is string => !!x))];
      if (estampaIds.length > 0) {
        await tx.estampa.updateMany({ where: { id: { in: estampaIds }, estado: { not: 'recibida' } }, data: { estado: 'recibida' } });
      }
    }
  });

  const actualizada = await prisma.ordenEstampa.findUnique({ where: { id }, include: { items: { orderBy: [{ skuLiso: 'asc' }, { gnNombre: 'asc' }, { talle: 'asc' }], include: { estampa: { select: { codigoInterno: true, nombreComercial: true } } } } } });
  return NextResponse.json(actualizada);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'reposicion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;
  await prisma.ordenEstampa.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
