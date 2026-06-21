import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAlguno } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Lista unificada de compras: Compra (genera stock) + Gasto con proveedor
// (compra sin stock). Los gastos sin proveedor (internos/auto) no aparecen acá.
export async function GET(req: NextRequest) {
  const session = await requireAlguno(req, ['insumos', 'gastos']);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const [compras, gastos] = await Promise.all([
    prisma.compra.findMany({ include: { proveedor: { select: { nombre: true } } }, orderBy: { fecha: 'desc' } }),
    prisma.gasto.findMany({
      where: { proveedorId: { not: null } },
      include: { proveedor: { select: { nombre: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const filasCompra = compras.map((c) => ({
    origen: 'compra' as const,
    id: c.id,
    fecha: c.fecha.toISOString().slice(0, 10),
    proveedorNombre: c.proveedor?.nombre ?? '—',
    concepto: c.numeroFactura ? `Factura ${c.numeroFactura}` : 'Compra de insumos',
    monto: Number(c.totalBruto),
    estadoPago: c.estadoPago as string | null,
    montoPagado: Number(c.montoPagado),
    generaStock: true,
    href: `/inventario/compras/${c.id}`,
  }));

  const filasGasto = gastos.map((g) => ({
    origen: 'gasto' as const,
    id: g.id,
    fecha: g.fecha,
    proveedorNombre: g.proveedor?.nombre ?? '—',
    concepto: g.concepto || `${g.categoria} · ${g.tipo}`,
    monto: g.monto,
    estadoPago: (g.estadoPago as string | null) ?? null,
    montoPagado: g.montoPagado != null ? Number(g.montoPagado) : 0,
    generaStock: false,
    href: `/compras/${g.id}`,
  }));

  const todas = [...filasCompra, ...filasGasto].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  return NextResponse.json(todas);
}
