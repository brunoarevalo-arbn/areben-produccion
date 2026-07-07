import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

// Valida el corte del cortador SIN hacer la ficha de tela: lo vuelve cobrable al
// instante (escribe costoCorte en la columna y marca corteEstado='validado').
// No toca stock ni rollos. La ficha de tela queda como paso aparte y opcional.
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;

  const orden = await prisma.ordenProduccion.findUnique({
    where: { id },
    select: { id: true, cantidad: true, corteEstado: true, fichaCorteCargada: true, cortadorId: true, fechaCorte: true, fichaCorteData: true },
  });
  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });
  if (orden.fichaCorteCargada) return NextResponse.json({ error: 'Este corte ya tiene ficha de corte' }, { status: 400 });
  if (orden.corteEstado !== 'cargado') return NextResponse.json({ error: 'El corte no está cargado por el cortador' }, { status: 400 });

  const fd = orden.fichaCorteData as Record<string, unknown> | null;
  const precio = Number(fd?.costoCorte) || 0;
  const total = fd?.modoCosto === 'unidad' ? precio * orden.cantidad : precio;
  if (total <= 0) return NextResponse.json({ error: 'Cargá el precio del corte antes de validar' }, { status: 400 });

  const cortador = orden.cortadorId ? await prisma.cortador.findUnique({ where: { id: orden.cortadorId }, select: { nombre: true } }) : null;
  const fechaCorte = typeof fd?.fechaCorte === 'string' ? new Date(`${fd.fechaCorte}T12:00:00Z`) : (orden.fechaCorte ?? new Date());

  await prisma.ordenProduccion.update({
    where: { id },
    data: { costoCorte: new Prisma.Decimal(total), corteEstado: 'validado', cortador: cortador?.nombre ?? null, fechaCorte },
  });

  return NextResponse.json({ ok: true });
}
