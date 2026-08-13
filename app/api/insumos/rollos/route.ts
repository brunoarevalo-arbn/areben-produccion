import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAlguno, getPermisos, can } from '@/lib/auth';

// Quién lista rollos: Inventario, la ficha de corte de Producción, y el retiro de
// tela para muestras (la diseñadora, con el permiso chico `muestras`).
const PUEDE_VER = ['insumos', 'produccion', 'muestras'] as const;
// El costo por kg NO viaja a quien solo tiene `muestras`: quien registra un retiro
// no ve plata (misma regla que GET /api/produccion/muestras).
const VE_COSTO = ['insumos', 'produccion', 'gastos'] as const;

export async function GET(req: NextRequest) {
  const session = await requireAlguno(req, [...PUEDE_VER]);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const permisos = await getPermisos(session);
  const veCosto = VE_COSTO.some((p) => can(permisos, p));

  const url = new URL(req.url);
  const insumoId = url.searchParams.get('insumoId');
  const estado = url.searchParams.get('estado');

  const where: Record<string, unknown> = {};
  if (insumoId) where.insumoId = insumoId;
  if (estado) where.estado = estado;

  const rollos = await prisma.rollo.findMany({
    where,
    omit: veCosto ? {} : { costoUnitario: true, costoUnitarioUsd: true },
    include: {
      insumo: { select: { nombre: true, categoria: true, unidadDefault: true, rinde: true, anchoCm: true, tubular: true } },
      color: { select: { id: true, nombre: true, abreviatura: true } },
      compra: { select: { id: true, fecha: true, proveedor: { select: { nombre: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(rollos);
}
