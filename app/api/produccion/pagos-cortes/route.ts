import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requirePermiso } from '@/lib/auth';
import { PagoCorteSchema } from '@/lib/validators/produccion';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const url = new URL(req.url);
  const filtroPago = url.searchParams.get('pago'); // 'pendiente' | 'pagado'
  const cortador = url.searchParams.get('cortador');

  const where: Record<string, unknown> = {
    fichaCorteCargada: true,
    costoCorte: { gt: 0 },
  };

  if (filtroPago === 'pendiente') where.pagoCorteId = null;
  if (filtroPago === 'pagado') where.pagoCorteId = { not: null };
  if (cortador) where.cortador = cortador;

  const ordenes = await prisma.ordenProduccion.findMany({
    where,
    select: {
      id: true,
      sku: true,
      cantidad: true,
      cortador: true,
      costoCorte: true,
      pagoCorteId: true,
      createdAt: true,
      estado: true,
      pagoCorte: { select: { id: true, fecha: true, beneficiario: true, montoTotal: true } },
      transiciones: {
        where: { estadoNuevo: 'CORTE' },
        orderBy: { fecha: 'desc' },
        take: 1,
        select: { fecha: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(ordenes);
}

export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const body = await req.json();
  const parsed = PagoCorteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { fecha, beneficiario, ordenIds, notas, comprobanteUrl } = parsed.data;

  // Validar que las OPs existen, tienen costoCorte > 0 y no estan ya pagadas
  const ordenes = await prisma.ordenProduccion.findMany({
    where: { id: { in: ordenIds } },
    select: { id: true, sku: true, costoCorte: true, pagoCorteId: true },
  });

  if (ordenes.length !== ordenIds.length) {
    return NextResponse.json({ error: 'Alguna OP no existe' }, { status: 400 });
  }

  for (const o of ordenes) {
    if (o.pagoCorteId) {
      return NextResponse.json({ error: `OP ${o.sku} ya tiene pago registrado` }, { status: 400 });
    }
    if (Number(o.costoCorte) <= 0) {
      return NextResponse.json({ error: `OP ${o.sku} no tiene costo de corte` }, { status: 400 });
    }
  }

  const montoTotal = ordenes.reduce((s, o) => s.add(o.costoCorte), new Prisma.Decimal(0));

  const pago = await prisma.$transaction(async (tx) => {
    const p = await tx.pagoCorte.create({
      data: {
        fecha: new Date(fecha),
        beneficiario: beneficiario.trim(),
        montoTotal,
        notas: notas?.trim() || null,
        comprobanteUrl: comprobanteUrl || null,
        creadoPor: session.nombre,
      },
    });

    await tx.ordenProduccion.updateMany({
      where: { id: { in: ordenIds } },
      data: { pagoCorteId: p.id },
    });

    return p;
  });

  return NextResponse.json(pago, { status: 201 });
}
