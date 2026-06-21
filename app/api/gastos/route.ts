import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { requirePermiso } from '@/lib/auth';
import { GastoSchema } from '@/lib/validators/insumos';
import { Prisma } from '@prisma/client';

async function requireAccess(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return null;
  if (session.rol === 'admin') return session;
  if (session.rol === 'costurera') return null;
  const user = await prisma.usuario.findUnique({ where: { id: session.id }, select: { permisos: true } });
  return user?.permisos.includes('gastos') ? session : null;
}

export async function GET(req: NextRequest) {
  const session = await requireAccess(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const categoria = searchParams.get('categoria');
  const marca     = searchParams.get('marca');

  const gastos = await prisma.gasto.findMany({
    where: {
      ...(categoria ? { categoria } : {}),
      ...(marca     ? { marca }     : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(gastos);
}

export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'gastos');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const parsed = GastoSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  const gasto = await prisma.gasto.create({
    data: {
      categoria: d.categoria,
      tipo:      d.tipo,
      marca:     d.marca    || null,
      sku:       d.sku      || null,
      ordenId:   d.ordenId  || null,
      minutos:   d.minutos  ?? null,
      monto:     d.monto    || 0,
      concepto:  d.concepto || null,
      fecha:     d.fecha,
      creadoPor: session.nombre,
      tiempoId:  d.tiempoId || null,
      // Compra a proveedor (opcionales)
      proveedorId:   d.proveedorId   || null,
      numeroFactura: d.numeroFactura || null,
      formaPago:     d.formaPago     || null,
      estadoPago:    d.estadoPago    ?? null,
      montoPagado:   d.montoPagado != null ? new Prisma.Decimal(d.montoPagado) : null,
      fechaPago:     d.fechaPago     || null,
    },
  });

  return NextResponse.json(gasto, { status: 201 });
}
