import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAlguno } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface Row {
  origen: 'compra' | 'gasto';
  id: string; fecha: string; concepto: string;
  monto: number; montoPagado: number; pendiente: number;
  estadoPago: string; href: string; pagoUrl: string;
}
interface Grupo {
  proveedorId: string; proveedorNombre: string;
  rows: Row[]; totalPendiente: number;
}

// Cuentas por pagar: Compra + Gasto-compra con estadoPago PENDIENTE/PARCIAL,
// agrupado por proveedor. Lo que se le debe a cada uno.
export async function GET(req: NextRequest) {
  const session = await requireAlguno(req, ['insumos', 'gastos']);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const [compras, gastos] = await Promise.all([
    prisma.compra.findMany({
      where: { estadoPago: { in: ['PENDIENTE', 'PARCIAL'] }, revertida: false },
      include: { proveedor: { select: { id: true, nombre: true } } },
    }),
    prisma.gasto.findMany({
      where: { proveedorId: { not: null }, estadoPago: { in: ['PENDIENTE', 'PARCIAL'] } },
      include: { proveedor: { select: { id: true, nombre: true } } },
    }),
  ]);

  const grupos = new Map<string, Grupo>();
  const add = (provId: string | null, provNombre: string | undefined, row: Row) => {
    const pid = provId ?? 'sin';
    if (!grupos.has(pid)) grupos.set(pid, { proveedorId: pid, proveedorNombre: provNombre ?? 'Sin proveedor', rows: [], totalPendiente: 0 });
    const g = grupos.get(pid)!;
    g.rows.push(row);
    g.totalPendiente += row.pendiente;
  };

  for (const c of compras) {
    const monto = Number(c.totalBruto);
    const pagado = Number(c.montoPagado);
    add(c.proveedorId, c.proveedor?.nombre, {
      origen: 'compra', id: c.id, fecha: c.fecha.toISOString().slice(0, 10),
      concepto: c.numeroFactura ? `Factura ${c.numeroFactura}` : 'Compra de insumos',
      monto, montoPagado: pagado, pendiente: Math.max(0, monto - pagado),
      estadoPago: c.estadoPago, href: `/inventario/compras/${c.id}`, pagoUrl: `/api/compras/${c.id}/pago`,
    });
  }
  for (const g of gastos) {
    const monto = g.monto;
    const pagado = g.montoPagado != null ? Number(g.montoPagado) : 0;
    add(g.proveedorId, g.proveedor?.nombre, {
      origen: 'gasto', id: g.id, fecha: g.fecha,
      concepto: g.concepto || `${g.categoria} · ${g.tipo}`,
      monto, montoPagado: pagado, pendiente: Math.max(0, monto - pagado),
      estadoPago: g.estadoPago ?? 'PENDIENTE', href: `/compras/${g.id}`, pagoUrl: `/api/gastos/${g.id}/pago`,
    });
  }

  const lista = [...grupos.values()].sort((a, b) => b.totalPendiente - a.totalPendiente);
  return NextResponse.json(lista);
}
