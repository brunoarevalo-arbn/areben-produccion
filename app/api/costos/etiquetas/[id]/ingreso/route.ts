import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAlguno } from '@/lib/auth';
import { AvioIngresoSchema } from '@/lib/validators/insumos';
import { Prisma } from '@prisma/client';

type Ctx = { params: Promise<{ id: string }> };

// Ingreso/compra de stock de un avío. Suma al stock y, si hay proveedor, crea
// un Gasto-compra (proveedor/factura/pago) que aparece en Compras + cuentas por pagar.
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requireAlguno(req, ['costos', 'insumos']);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const parsed = AvioIngresoSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  const avio = await prisma.etiquetaCatalogo.findUnique({ where: { id } });
  if (!avio) return NextResponse.json({ error: 'Avío no encontrado' }, { status: 404 });

  const costoUnit = d.costoUnitario ?? 0;
  const fechaHoy = new Date().toISOString().slice(0, 10);

  const result = await prisma.$transaction(async (tx) => {
    // Stock: si estaba sin seguimiento (null), empieza a trackear en cantidad.
    const nuevoStock = (avio.stock ?? 0) + d.cantidad;
    const dataAvio: Record<string, unknown> = { stock: nuevoStock };
    // Solo pisa el precio de referencia si el costo es > 0 (evita dejarlo en $0).
    if (d.actualizarPrecio && d.costoUnitario != null && d.costoUnitario > 0) dataAvio.precio = new Prisma.Decimal(d.costoUnitario);
    await tx.etiquetaCatalogo.update({ where: { id }, data: dataAvio });

    // Gasto-compra (solo si hay proveedor): aparece en Compras + cuentas por pagar.
    let gastoId: string | null = null;
    if (d.proveedorId) {
      const gasto = await tx.gasto.create({
        data: {
          categoria: 'produccion',
          tipo:      'insumos',
          monto:     d.cantidad * costoUnit,
          concepto:  `Compra avío: ${avio.nombre} (${d.cantidad} u)`,
          fecha:     fechaHoy,
          creadoPor: session.nombre,
          proveedorId:   d.proveedorId,
          numeroFactura: d.numeroFactura || null,
          formaPago:     d.formaPago || null,
          estadoPago:    d.estadoPago ?? null,
          montoPagado:   d.montoPagado != null ? new Prisma.Decimal(d.montoPagado) : null,
          fechaPago:     d.fechaPago || null,
        },
      });
      gastoId = gasto.id;
    }

    await tx.avioMovimiento.create({
      data: {
        etiquetaId: id,
        tipo: 'INGRESO',
        cantidad: d.cantidad,
        costoUnitario: d.costoUnitario != null ? new Prisma.Decimal(d.costoUnitario) : null,
        gastoId,
        proveedorId: d.proveedorId || null,
        motivo: d.motivo || (d.proveedorId ? 'Compra' : 'Ingreso manual'),
        creadoPor: session.nombre,
      },
    });

    return nuevoStock;
  });

  return NextResponse.json({ ok: true, stock: result }, { status: 201 });
}
