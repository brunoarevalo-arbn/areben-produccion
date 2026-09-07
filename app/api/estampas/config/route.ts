import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso, requireAdmin } from '@/lib/auth';
import { resolverPrecioDtf, precioDtfVencido } from '@/lib/costos/dtfPrecio';

const ID = 'singleton';

// Precio fijo del DTF (rollo) + ancho + separación de corte + rechazo default. Global;
// lo setea admin. La separación entra en la TIRA (lib/costos/estampaCosto.ts): es cuánto
// margen se deja entre dos estampas, y en un diseño chico pesa tanto como el diseño.
// El $/metro NO sale de acá: sale de la última compra (lib/costos/dtfPrecio.ts). Se
// devuelve además `precioFuente` y `precioFecha` porque una pantalla que muestra un
// número sin decir de dónde salió no deja ver que está viejo — que es exactamente cómo
// el precio tipeado se quedó en $11.500 contra $9.500 reales.
async function resolver() {
  const [cfg, compras] = await Promise.all([
    prisma.configCostos.upsert({ where: { id: ID }, create: { id: ID }, update: {} }),
    prisma.compraDtf.findMany({ orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }], take: 5, include: { proveedor: { select: { nombre: true } } } }),
  ]);
  const p = resolverPrecioDtf(compras.map((c) => ({
    id: c.id, fecha: c.fecha, metros: Number(c.metros), precioMetro: Number(c.precioMetro),
    flete: Number(c.flete), proveedor: c.proveedor?.nombre ?? null, numeroFactura: c.numeroFactura,
  })), cfg.dtfPrecioMetro);
  return {
    dtfPrecioMetro:  p.precioMetro ?? 0,
    precioFuente:    p.fuente,
    precioFecha:     p.fecha ?? null,
    precioVencido:   precioDtfVencido(p),
    precioCompra:    p.compra ? { metros: p.compra.metros, precioMetro: p.compra.precioMetro, flete: p.compra.flete, proveedor: p.compra.proveedor ?? null } : null,
    dtfPrecioManual: cfg.dtfPrecioMetro,
    dtfAnchoCm:      cfg.dtfAnchoCm,
    dtfSeparacionCm: cfg.dtfSeparacionCm,
    dtfMermaDefault: cfg.dtfMermaDefault,
  };
}

export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'estamperia'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  return NextResponse.json(await resolver());
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
  const body = await req.json();
  // `dtfPrecioMetro` acá es el FALLBACK a mano: si hay una compra cargada, no se usa.
  const data = {
    dtfPrecioMetro: Number(body.dtfPrecioManual ?? body.dtfPrecioMetro) || 0,
    dtfAnchoCm:     Number(body.dtfAnchoCm) || 58,
    dtfSeparacionCm: Number(body.dtfSeparacionCm) || 0,
    dtfMermaDefault: Number(body.dtfMermaDefault) || 0,
  };
  await prisma.configCostos.upsert({ where: { id: ID }, create: { id: ID, ...data }, update: data });
  return NextResponse.json(await resolver());
}
