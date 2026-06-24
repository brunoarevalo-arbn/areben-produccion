import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requirePermiso } from '@/lib/auth';
import { deshacerCierreOrden, revertirConsumoTela } from '@/lib/produccion/cierre';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const orden = await prisma.ordenProduccion.findUnique({
    where: { id },
    include: {
      transiciones: { orderBy: { fecha: 'desc' } },
      movimientosInsumo: {
        include: {
          rollo: { select: { codigo: true, insumo: { select: { nombre: true } }, color: { select: { nombre: true } } } },
          lote: { select: { codigo: true, insumo: { select: { nombre: true } }, color: { select: { nombre: true } } } },
        },
      },
    },
  });

  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });
  return NextResponse.json(orden);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'produccion'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { descripcion, cantidad, notas } = body;

  const data: Record<string, unknown> = {};

  if (descripcion !== undefined) {
    data.descripcion = typeof descripcion === 'string' && descripcion.trim() ? descripcion.trim() : null;
  }
  if (cantidad !== undefined) {
    const n = parseInt(cantidad);
    if (!Number.isFinite(n) || n < 1) {
      return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 });
    }
    data.cantidad = n;
  }
  if (notas !== undefined) {
    data.notas = typeof notas === 'string' && notas.trim() ? notas.trim() : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
  }

  const orden = await prisma.ordenProduccion.update({ where: { id }, data });
  return NextResponse.json(orden);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!(await requirePermiso(req, 'produccion'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  // Antes de borrar la OP hay que deshacer su impacto en stock: reponer lo que
  // ingresó a terminados + los avíos, y devolver la tela consumida en el corte.
  // Si no, eliminar deja stock inflado y rollos sin reponer.
  await prisma.$transaction(async (tx) => {
    await deshacerCierreOrden(tx, id);
    await revertirConsumoTela(tx, id);
    await tx.ordenAvio.deleteMany({ where: { ordenId: id } });
    await tx.cortePorTalle.deleteMany({ where: { ordenId: id } });
    await tx.estadoTransicion.deleteMany({ where: { ordenId: id } });
    await tx.ordenProduccion.delete({ where: { id } });
  });
  return NextResponse.json({ ok: true });
}
