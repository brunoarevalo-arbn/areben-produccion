import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { PagoCorteSchema } from '@/lib/validators/produccion';
import { Prisma } from '@prisma/client';
import { CORTE_COBRABLE, SIN_IMPUTAR, IMPUTADO, cuentaDe } from '@/lib/produccion/cuenta-cortador';

// Devuelve costo de corte y beneficiario: pide `produccion`, no solo sesión (si no,
// la tablet de costureras también lo leía). Mismo criterio que cortes-muestra.
export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'produccion'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const url = new URL(req.url);
  const filtroPago = url.searchParams.get('pago'); // 'pendiente' | 'pagado'
  const cortador = url.searchParams.get('cortador');

  const where: Prisma.OrdenProduccionWhereInput = { ...CORTE_COBRABLE };

  // Acá `pagoCorteId` sí se usa: es un filtro de LISTA (qué falta imputar), no plata.
  if (filtroPago === 'pendiente') Object.assign(where, SIN_IMPUTAR);
  if (filtroPago === 'pagado') Object.assign(where, IMPUTADO);
  if (cortador) where.cortador = cortador;

  const ordenes = await prisma.ordenProduccion.findMany({
    where,
    select: {
      id: true,
      sku: true,
      cantidad: true,
      cortador: true,
      cortadorId: true,
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

  // UNA sola rama: la plata la pone el `monto`, siempre. Los cortes y muestras que vengan
  // se vinculan como trazabilidad y no aportan un peso — en la cuenta corriente la deuda es
  // todo lo cortado y el haber es todo lo pagado (ver lib/produccion/cuenta-cortador.ts).
  // Antes había una rama que DERIVABA el monto sumando los ítems: ese era el camino por el
  // que la misma plata entraba dos veces cuando ya había un adelanto cargado.
  const cortador = await prisma.cortador.findUnique({ where: { id: cortadorId }, select: { id: true, nombre: true, activo: true } });
  if (!cortador) return NextResponse.json({ error: 'El cortador no existe' }, { status: 400 });
  if (!cortador.activo) return NextResponse.json({ error: `${cortador.nombre} está dado de baja` }, { status: 400 });

  // Los ítems se validan igual aunque no muevan el número: una traza mentirosa (un corte de
  // otro cortador, o colgado de dos pagos) es peor que no tener traza.
  const ordenes = await prisma.ordenProduccion.findMany({
    where: { id: { in: ordenIds } },
    select: { id: true, sku: true, costoCorte: true, pagoCorteId: true, cortadorId: true },
  });
  if (ordenes.length !== ordenIds.length) return NextResponse.json({ error: 'Alguna OP no existe' }, { status: 400 });
  for (const o of ordenes) {
    if (o.pagoCorteId) return NextResponse.json({ error: `OP ${o.sku} ya está imputada a otro pago` }, { status: 400 });
    if (Number(o.costoCorte) <= 0) return NextResponse.json({ error: `OP ${o.sku} no tiene costo de corte` }, { status: 400 });
    if (o.cortadorId !== cortador.id) return NextResponse.json({ error: `OP ${o.sku} es de otro cortador: registrá un pago por cortador` }, { status: 400 });
  }

  const muestras = await prisma.corteMuestra.findMany({
    where: { id: { in: muestraIds } },
    select: { id: true, descripcion: true, valor: true, estado: true, pagoCorteId: true, cortadorId: true },
  });
  if (muestras.length !== muestraIds.length) return NextResponse.json({ error: 'Alguna muestra no existe' }, { status: 400 });
  for (const m of muestras) {
    if (m.pagoCorteId) return NextResponse.json({ error: `La muestra "${m.descripcion}" ya está imputada a otro pago` }, { status: 400 });
    if (m.estado !== 'validado') return NextResponse.json({ error: `La muestra "${m.descripcion}" no está validada` }, { status: 400 });
    if (m.cortadorId !== cortador.id) return NextResponse.json({ error: `La muestra "${m.descripcion}" es de otro cortador` }, { status: 400 });
  }

  const pago = await prisma.$transaction(async (tx) => {
    const p = await tx.pagoCorte.create({
      data: {
        fecha: new Date(fecha),
        beneficiario: beneficiario.trim() || cortador.nombre,
        montoTotal: new Prisma.Decimal(monto),
        cortadorId: cortador.id,
        notas: notas?.trim() || null,
        comprobanteUrl: comprobanteUrl || null,
        creadoPor: session.nombre,
      },
    });
    if (ordenIds.length) await tx.ordenProduccion.updateMany({ where: { id: { in: ordenIds } }, data: { pagoCorteId: p.id } });
    if (muestraIds.length) await tx.corteMuestra.updateMany({ where: { id: { in: muestraIds } }, data: { pagoCorteId: p.id } });
    return p;
  });

  return NextResponse.json({ ...pago, cuenta: await cuentaDe(cortador.id) }, { status: 201 });
}
