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
  notas:         z.string().nullable().optional(),
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
    notas: c.notas, creadoPor: c.creadoPor,
  })));
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;
  const creada = await prisma.compraDtf.create({
    data: {
      fecha:         new Date(d.fecha),
      metros:        new Prisma.Decimal(d.metros),
      precioMetro:   new Prisma.Decimal(d.precioMetro),
      flete:         new Prisma.Decimal(d.flete ?? 0),
      proveedorId:   d.proveedorId || null,
      numeroFactura: d.numeroFactura?.trim() || null,
      notas:         d.notas?.trim() || null,
      creadoPor:     session.nombre,
    },
  });
  return NextResponse.json({ id: creada.id }, { status: 201 });
}
