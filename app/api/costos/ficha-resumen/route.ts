import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { consumoNetoPorRollo } from '@/lib/produccion/consumo';

// Resumen de la ficha de corte de un SKU para el escandallo: consumo neto de tela
// (kg/metros por prenda), costo de tela y corte por prenda, y los avíos que la ficha
// dejó anotados. Sirve para ver qué se consideró (o no) en la ficha.
export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'costos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const sku = req.nextUrl.searchParams.get('sku')?.trim();
  if (!sku) return NextResponse.json({ error: 'SKU requerido' }, { status: 400 });

  const orden = await prisma.ordenProduccion.findFirst({
    where: { sku: { equals: sku, mode: 'insensitive' }, fichaCorteCargada: true },
    orderBy: { createdAt: 'desc' },
    include: {
      avios: { include: { etiqueta: { select: { nombre: true, precio: true } } } },
      movimientosInsumo: {
        where: { rolloId: { not: null } },
        include: { rollo: { select: { insumo: { select: { unidadDefault: true, rinde: true } } } } },
      },
    },
  });

  if (!orden) return NextResponse.json({ encontrado: false });

  const { kg, metros } = consumoNetoPorRollo(
    orden.movimientosInsumo.map((m) => ({ rolloId: m.rolloId, cantidad: Number(m.cantidad), unidadDefault: m.rollo?.insumo.unidadDefault ?? null, rinde: m.rollo?.insumo.rinde ? Number(m.rollo.insumo.rinde) : null })),
  );
  const cant = orden.cantidad || 0;
  const costoTelaUnit = cant > 0 ? (Number(orden.costoTela) + Number(orden.costoInsumosSecundarios)) / cant : null;
  const costoCorteUnit = cant > 0 ? Number(orden.costoCorte) / cant : null;

  // Avíos de la ficha con su costo por prenda (cantidad de OrdenAvio ya es por prenda).
  const avios = orden.avios.map((a) => {
    const precio = Number(a.etiqueta.precio) || 0;
    return { nombre: a.etiqueta.nombre, cantidad: a.cantidad, costo: precio * a.cantidad };
  });
  const costoAviosUnit = avios.reduce((s, a) => s + a.costo, 0);

  return NextResponse.json({
    encontrado: true,
    cantidad: cant,
    costoTelaUnit,
    costoCorteUnit,
    costoAviosUnit,
    kgUnit: cant > 0 ? kg / cant : 0,
    metrosUnit: cant > 0 ? metros / cant : 0,
    avios,
  });
}
