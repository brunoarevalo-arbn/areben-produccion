import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { PagoCorteSchema } from '@/lib/validators/produccion';
import { Prisma } from '@prisma/client';

// Devuelve costo de corte y beneficiario: pide `produccion`, no solo sesión (si no,
// la tablet de costureras también lo leía). Mismo criterio que cortes-muestra.
export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'produccion'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const url = new URL(req.url);
  const filtroPago = url.searchParams.get('pago'); // 'pendiente' | 'pagado'
  const cortador = url.searchParams.get('cortador');

  const where: Record<string, unknown> = {
    costoCorte: { gt: 0 },
    OR: [{ fichaCorteCargada: true }, { corteEstado: 'validado' }],
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

  const { fecha, beneficiario, ordenIds, muestraIds, cortadorId, monto, notas, comprobanteUrl } = parsed.data;

  // ── Pago A CUENTA: sin ítems, monto libre. No imputa nada; solo baja el saldo
  // del cortador en la cuenta corriente. El cortadorId es obligatorio porque es lo
  // único que ata el pago a una cuenta (el `beneficiario` es texto libre).
  if (ordenIds.length === 0 && muestraIds.length === 0) {
    const cortador = await prisma.cortador.findUnique({ where: { id: cortadorId! }, select: { id: true, nombre: true, activo: true } });
    if (!cortador) return NextResponse.json({ error: 'El cortador no existe' }, { status: 400 });
    if (!cortador.activo) return NextResponse.json({ error: `${cortador.nombre} está dado de baja` }, { status: 400 });

    const pago = await prisma.pagoCorte.create({
      data: {
        fecha: new Date(fecha),
        beneficiario: beneficiario.trim() || cortador.nombre,
        montoTotal: new Prisma.Decimal(monto!),
        cortadorId: cortador.id,
        notas: notas?.trim() || null,
        comprobanteUrl: comprobanteUrl || null,
        creadoPor: session.nombre,
      },
    });
    return NextResponse.json(pago, { status: 201 });
  }

  // Validar que las OPs existen, tienen costoCorte > 0 y no estan ya pagadas
  const ordenes = await prisma.ordenProduccion.findMany({
    where: { id: { in: ordenIds } },
    select: { id: true, sku: true, costoCorte: true, pagoCorteId: true, cortadorId: true },
  });
  if (ordenes.length !== ordenIds.length) {
    return NextResponse.json({ error: 'Alguna OP no existe' }, { status: 400 });
  }
  for (const o of ordenes) {
    if (o.pagoCorteId) return NextResponse.json({ error: `OP ${o.sku} ya tiene pago registrado` }, { status: 400 });
    if (Number(o.costoCorte) <= 0) return NextResponse.json({ error: `OP ${o.sku} no tiene costo de corte` }, { status: 400 });
  }

  // Muestras: deben estar validadas y sin pago
  const muestras = await prisma.corteMuestra.findMany({
    where: { id: { in: muestraIds } },
    select: { id: true, descripcion: true, valor: true, estado: true, pagoCorteId: true, cortadorId: true },
  });
  if (muestras.length !== muestraIds.length) return NextResponse.json({ error: 'Alguna muestra no existe' }, { status: 400 });
  for (const m of muestras) {
    if (m.pagoCorteId) return NextResponse.json({ error: `La muestra "${m.descripcion}" ya está pagada` }, { status: 400 });
    if (m.estado !== 'validado') return NextResponse.json({ error: `La muestra "${m.descripcion}" no está validada` }, { status: 400 });
  }

  const montoTotal = [...ordenes.map((o) => o.costoCorte), ...muestras.map((m) => m.valor)]
    .reduce((s, v) => s.add(v), new Prisma.Decimal(0));

  // Cortador del pago: se infiere de los ítems solo si todos son del mismo (un pago
  // multi-cortador queda sin dueño, como hasta ahora). Es informativo — el saldo de
  // los pagos imputados se sigue calculando por los ítems marcados, no por este campo.
  const idsCortador = [...new Set([...ordenes, ...muestras].map((i) => i.cortadorId).filter(Boolean))];
  const cortadorDelPago = cortadorId ?? (idsCortador.length === 1 ? idsCortador[0]! : null);

  const pago = await prisma.$transaction(async (tx) => {
    const p = await tx.pagoCorte.create({
      data: {
        fecha: new Date(fecha),
        beneficiario: beneficiario.trim(),
        montoTotal,
        cortadorId: cortadorDelPago,
        notas: notas?.trim() || null,
        comprobanteUrl: comprobanteUrl || null,
        creadoPor: session.nombre,
      },
    });
    if (ordenIds.length) await tx.ordenProduccion.updateMany({ where: { id: { in: ordenIds } }, data: { pagoCorteId: p.id } });
    if (muestraIds.length) await tx.corteMuestra.updateMany({ where: { id: { in: muestraIds } }, data: { pagoCorteId: p.id } });
    return p;
  });

  return NextResponse.json(pago, { status: 201 });
}
