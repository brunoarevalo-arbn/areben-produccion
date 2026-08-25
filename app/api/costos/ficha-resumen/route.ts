import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { fichaDetalleSku, agruparPorArticulo } from '@/lib/produccion/fichaConsumo';

// Resumen de la ficha de corte de un SKU para el escandallo: consumo neto de tela
// (kg/metros por prenda), costo de tela y corte por prenda, el DESGLOSE POR TELA —también
// por prenda— y los avíos que la ficha dejó anotados.
//
// El desglose es el punto: una prenda de dos telas (encaje + microfibra) mostraba un solo
// número mezclado y no se podía saber cuánto pone cada una. Sale de `fichaDetalleSku`, el
// mismo helper que usa el PDF, para que las dos pantallas no diverjan.
export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'costos'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const sku = req.nextUrl.searchParams.get('sku')?.trim();
  if (!sku) return NextResponse.json({ error: 'SKU requerido' }, { status: 400 });

  const ficha = await fichaDetalleSku(sku);
  if (!ficha) return NextResponse.json({ encontrado: false });

  // El costo de tela de la OP (el que manda) incluye los insumos secundarios del corte,
  // que no salen de ningún rollo: se piden aparte para que el total siga siendo el mismo.
  const orden = await prisma.ordenProduccion.findUnique({
    where: { id: ficha.orden.id },
    select: { costoTela: true, costoInsumosSecundarios: true, costoCorte: true, costoSublimacion: true },
  });

  const cant = ficha.orden.cantidad || 0;
  const costoTelaUnit = orden && cant > 0 ? (Number(orden.costoTela) + Number(orden.costoInsumosSecundarios)) / cant : null;
  const costoCorteUnit = orden && cant > 0 ? Number(orden.costoCorte) / cant : null;
  const costoSublimacionUnit = orden && cant > 0 ? Number(orden.costoSublimacion) / cant : null;

  const grupos = agruparPorArticulo(ficha);
  const telas = grupos.map((g) => ({
    articulo: g.articulo, color: g.color,
    metrosUnit: g.metrosUnit, kgUnit: g.kgUnit, costoUnit: g.costoUnit,
  }));
  // El desglose tiene que CERRAR contra el total: lo que no salió de un rollo (insumos
  // secundarios del corte, redondeo, reversiones) va como una fila propia y no se esconde.
  if (costoTelaUnit != null) {
    const resto = costoTelaUnit - telas.reduce((s, t) => s + t.costoUnit, 0);
    if (Math.abs(resto) > 0.01) telas.push({ articulo: 'Otros insumos del corte', color: null, metrosUnit: 0, kgUnit: 0, costoUnit: resto });
  }

  const avios = ficha.avios.map((a) => ({ nombre: a.nombre, cantidad: a.cantidad, costo: a.costo }));
  const costoAviosUnit = avios.reduce((s, a) => s + a.costo, 0);

  return NextResponse.json({
    encontrado: true,
    cantidad: cant,
    costoTelaUnit,
    costoCorteUnit,
    costoSublimacionUnit,
    costoAviosUnit,
    metrosTotal: ficha.totales.metros,
    kgTotal: ficha.totales.kg,
    kgUnit: ficha.totales.kgUnit,
    metrosUnit: ficha.totales.metrosUnit,
    telas,
    avios,
  });
}
