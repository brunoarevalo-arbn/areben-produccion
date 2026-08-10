// Detalle de la ficha de corte de un SKU: qué telas (artículo + rollo) se consumieron, a qué
// precio, y qué avíos quedaron anotados. Sirve para que el PDF de costos muestre el desglose
// real —no solo el total— y se pueda verificar contra el producto. Usa la OP más reciente con
// ficha cargada (el SKU es único por OP, así que en la práctica es LA OP de ese SKU).
import { prisma } from '@/lib/prisma';
import { consumoNetoPorRollo } from '@/lib/produccion/consumo';

export interface FichaTelaFila {
  rolloId: string;
  codigo: string;        // código del rollo
  articulo: string;      // nombre del insumo (la tela: microfibra, tul…)
  color: string | null;
  metros: number;
  kg: number;
  precioKg: number;      // $/kg del rollo
  precioMetro: number;   // $/metro derivado con el rinde
  costo: number;         // consumo neto × costo unitario del rollo
}

export interface FichaDetalle {
  orden: { id: string; sku: string | null; marca: string; descripcion: string | null; cantidad: number; fechaCorte: Date | null; cortador: string | null };
  telas: FichaTelaFila[];
  totales: { metros: number; kg: number; costo: number; metrosUnit: number; kgUnit: number };
  avios: { nombre: string; cantidad: number; precio: number; costo: number }[];
}

export async function fichaDetalleSku(sku: string | null | undefined): Promise<FichaDetalle | null> {
  if (!sku?.trim()) return null;
  const orden = await prisma.ordenProduccion.findFirst({
    where: { sku: { equals: sku.trim(), mode: 'insensitive' }, fichaCorteCargada: true },
    orderBy: { createdAt: 'desc' },
    include: {
      avios: { include: { etiqueta: { select: { nombre: true, precio: true } } } },
      movimientosInsumo: {
        where: { rolloId: { not: null } },
        include: {
          rollo: {
            select: {
              codigo: true, costoUnitario: true, colorProveedor: true,
              color: { select: { nombre: true } },
              insumo: { select: { nombre: true, nombreInterno: true, unidadDefault: true, rinde: true } },
            },
          },
        },
        orderBy: { fecha: 'asc' },
      },
    },
  });
  if (!orden) return null;

  const { kg, metros, porRollo } = consumoNetoPorRollo(
    orden.movimientosInsumo.map((m) => ({ rolloId: m.rolloId, cantidad: Number(m.cantidad), unidadDefault: m.rollo?.insumo.unidadDefault ?? null, rinde: m.rollo?.insumo.rinde ? Number(m.rollo.insumo.rinde) : null })),
  );

  // Datos de display por rollo: el primer movimiento de cada uno ya los trae.
  const info = new Map<string, NonNullable<(typeof orden.movimientosInsumo)[number]['rollo']>>();
  for (const m of orden.movimientosInsumo) {
    if (m.rolloId && m.rollo && !info.has(m.rolloId)) info.set(m.rolloId, m.rollo);
  }

  const telas: FichaTelaFila[] = [];
  for (const [rolloId, v] of porRollo) {
    const r = info.get(rolloId);
    if (!r) continue;
    // El costo unitario del rollo está en la unidad del insumo: si es kg, el $/metro sale
    // del rinde; si el insumo se mide en metros, el $/kg es el que se deriva.
    const costoUnit = Number(r.costoUnitario);
    const rinde = r.insumo.rinde ? Number(r.insumo.rinde) : 0;
    const enKg = (r.insumo.unidadDefault || '').toLowerCase().includes('kg');
    const precioKg = enKg ? costoUnit : costoUnit * rinde;
    const precioMetro = enKg ? (rinde > 0 ? costoUnit / rinde : 0) : costoUnit;
    telas.push({
      rolloId,
      codigo: r.codigo,
      articulo: r.insumo.nombreInterno || r.insumo.nombre,
      color: r.color?.nombre ?? r.colorProveedor ?? null,
      metros: v.metros,
      kg: v.kg,
      precioKg,
      precioMetro,
      costo: v.consumo * costoUnit,
    });
  }
  // Los rollos de la misma tela quedan juntos (y el mismo artículo se lee de corrido).
  telas.sort((a, b) => a.articulo.localeCompare(b.articulo, 'es') || a.codigo.localeCompare(b.codigo, 'es'));

  const cant = orden.cantidad || 0;
  return {
    orden: { id: orden.id, sku: orden.sku, marca: orden.marca, descripcion: orden.descripcion, cantidad: cant, fechaCorte: orden.fechaCorte, cortador: orden.cortador },
    telas,
    totales: {
      metros, kg,
      costo: telas.reduce((s, t) => s + t.costo, 0),
      metrosUnit: cant > 0 ? metros / cant : 0,
      kgUnit: cant > 0 ? kg / cant : 0,
    },
    // La cantidad de OrdenAvio ya es POR PRENDA.
    avios: orden.avios.map((a) => {
      const precio = Number(a.etiqueta.precio) || 0;
      return { nombre: a.etiqueta.nombre, cantidad: a.cantidad, precio, costo: precio * a.cantidad };
    }),
  };
}
