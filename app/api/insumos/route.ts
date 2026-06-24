import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireInsumos } from '@/lib/auth';
import { InsumoCatalogoSchema } from '@/lib/validators/insumos';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const insumos = await prisma.insumo.findMany({
    orderBy: { nombre: 'asc' },
    include: {
      colores: {
        where: { activo: true },
        include: { skuCatalogo: { select: { nombre: true, abreviatura: true } } },
      },
      rollos: {
        where: { estado: { not: 'DESCARTADO' } },
        select: { id: true, codigo: true, pesoActual: true, costoUnitario: true, estado: true, colorId: true, colorProveedor: true },
      },
      lotes: {
        where: { estado: { not: 'AGOTADO' } },
        select: { id: true, codigo: true, cantidadActual: true, costoUnitario: true, estado: true, colorId: true, colorProveedor: true },
      },
    },
  });

  const result = insumos.map((ins) => {
    const stockRollos = ins.rollos.reduce((sum, r) => sum + Number(r.pesoActual), 0);
    const stockLotes = ins.lotes.reduce((sum, l) => sum + Number(l.cantidadActual), 0);
    return {
      ...ins,
      stockTotal: ins.tipoTrazabilidad === 'rollo' ? stockRollos : stockLotes,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await requireInsumos(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const body = await req.json();
  const parsed = InsumoCatalogoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const insumo = await prisma.insumo.create({ data: parsed.data });
  return NextResponse.json(insumo, { status: 201 });
}
