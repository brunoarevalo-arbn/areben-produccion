import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermiso, requireAdmin } from '@/lib/auth';
import { z } from 'zod';

// Compras de DTF. De la ÚLTIMA sale el $/metro de todo el módulo, así que cargar una
// acá mueve el costo de todos los productos con estampa: lo escribe sólo admin.
const Schema = z.object({
  fecha:         z.string().min(1, 'Falta la fecha'),
  metros:        z.number().positive('Los metros tienen que ser > 0'),
  precioMetro:   z.number().positive('El precio por metro tiene que ser > 0'),
  flete:         z.number().min(0).optional(),
  proveedorId:   z.string().nullable().optional(),
  numeroFactura: z.string().nullable().optional(),
  ordenId:       z.string().nullable().optional(), // la orden para la que se compró
  notas:         z.string().nullable().optional(),
  // Si la factura además tiene que entrar a cuentas por pagar, se crea el Gasto acá y
  // se guarda su id. ⚠️ La plata entra UNA sola vez, por el Gasto: `gastoId` en la
  // compra es TRAZABILIDAD, no un monto — el mismo criterio que arregló la cuenta de
  // los cortadores, donde dos formas de restar lo mismo lo contaban dos veces.
  crearGasto:    z.boolean().optional(),
  estadoPago:    z.enum(['PENDIENTE', 'PARCIAL', 'PAGADA']).optional(),
  formaPago:     z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'estamperia'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const compras = await prisma.compraDtf.findMany({
    orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    take: 50,
    include: { proveedor: { select: { nombre: true } } },
  });
  return NextResponse.json(compras.map((c) => ({
    id: c.id, fecha: c.fecha, metros: Number(c.metros), precioMetro: Number(c.precioMetro),
    flete: Number(c.flete), proveedor: c.proveedor?.nombre ?? null, numeroFactura: c.numeroFactura,
    ordenId: c.ordenId, gastoId: c.gastoId, notas: c.notas, creadoPor: c.creadoPor,
  })));
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;
  const total = d.metros * d.precioMetro + (d.flete ?? 0);

  const creada = await prisma.$transaction(async (tx) => {
    let gastoId: string | null = null;
    if (d.crearGasto) {
      const g = await tx.gasto.create({
        data: {
          categoria:     'produccion',
          tipo:          'insumos',
          monto:         total,
          concepto:      `DTF · ${d.metros} m a $${Math.round(d.precioMetro).toLocaleString('es-AR')}/m${(d.flete ?? 0) > 0 ? ` + $${Math.round(d.flete!).toLocaleString('es-AR')} de flete` : ''}`,
          fecha:         d.fecha,
          proveedorId:   d.proveedorId || null,
          numeroFactura: d.numeroFactura?.trim() || null,
          formaPago:     d.formaPago?.trim() || null,
          estadoPago:    d.estadoPago ?? 'PENDIENTE',
          montoPagado:   new Prisma.Decimal(d.estadoPago === 'PAGADA' ? total : 0),
          creadoPor:     session.nombre,
        },
      });
      gastoId = g.id;
    }
    return tx.compraDtf.create({
      data: {
        fecha:         new Date(d.fecha),
        metros:        new Prisma.Decimal(d.metros),
        precioMetro:   new Prisma.Decimal(d.precioMetro),
        flete:         new Prisma.Decimal(d.flete ?? 0),
        proveedorId:   d.proveedorId || null,
        numeroFactura: d.numeroFactura?.trim() || null,
        ordenId:       d.ordenId || null,
        gastoId,
        notas:         d.notas?.trim() || null,
        creadoPor:     session.nombre,
      },
    });
  });
  return NextResponse.json({ id: creada.id, gastoId: creada.gastoId }, { status: 201 });
}
