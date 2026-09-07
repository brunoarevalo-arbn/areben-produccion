import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { resolverPrecioDtf } from '@/lib/costos/dtfPrecio';
import { z } from 'zod';

// Un ítem nace de un producto de GN (reposición: ya se vende) o de una Estampa
// (lanzamiento: todavía no existe en GN). Exactamente uno de los dos, y coherente
// con el `origen` de la orden — la regla vive acá, no repartida en las pantallas.
const BodySchema = z.object({
  notas: z.string().optional(),
  tipo: z.enum(['estampa', 'produccion']).default('estampa'),
  origen: z.enum(['reposicion', 'lanzamiento']).default('reposicion'),
  items: z.array(z.object({
    gnId:      z.number().int().nullable().optional(),
    gnNombre:  z.string().optional(),
    estampaId: z.string().optional(),
    skuLiso:   z.string().min(1),
    talle:     z.string().min(1),
    cantidad:  z.number().int().positive(),
  })).min(1, 'No hay nada para estampar'),
}).superRefine((b, ctx) => {
  b.items.forEach((i, idx) => {
    const tieneGn = i.gnId != null;
    const tieneEstampa = !!i.estampaId;
    if (tieneGn === tieneEstampa) {
      ctx.addIssue({ code: 'custom', path: ['items', idx], message: 'Cada ítem va con un producto de Gestión Nube o con una estampa, no con los dos ni con ninguno' });
      return;
    }
    if (b.origen === 'lanzamiento' && !tieneEstampa) {
      ctx.addIssue({ code: 'custom', path: ['items', idx], message: 'Una orden de lanzamiento se pide por estampa' });
    }
    if (b.origen === 'reposicion' && !tieneGn) {
      ctx.addIssue({ code: 'custom', path: ['items', idx], message: 'Una orden de reposición se pide por producto de Gestión Nube' });
    }
  });
});

export async function GET(req: NextRequest) {
  const session = await requirePermiso(req, 'reposicion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const ordenes = await prisma.ordenEstampa.findMany({
    orderBy: { creadoAt: 'desc' },
    take: 50,
    include: {
      items: {
        orderBy: [{ skuLiso: 'asc' }, { gnNombre: 'asc' }, { talle: 'asc' }],
        // Las medidas viajan con el ítem: son las que dejan calcular cuánto rollo pide
        // la orden y contrastarlo con lo que se compró.
        include: { estampa: { select: { codigoInterno: true, nombreComercial: true, anchoCm: true, largoCm: true, ancho2Cm: true, largo2Cm: true } } },
      },
      comprasDtf: { select: { id: true, fecha: true, metros: true, precioMetro: true, flete: true, gastoId: true } },
    },
  });
  // 🔴 El ítem apunta a UNA estampa (la espalda), pero la prenda puede llevar también el
  // frente: otro planchado y otra área de DTF. La relación vive en `ProductoEstampado`,
  // así que de ahí salen TODAS las caras de cada prenda. Sin esto la orden se mide corta
  // y el número parece bueno.
  const productos = await prisma.productoEstampado.findMany({ select: { estampas: true } });
  const medidas = new Map((await prisma.estampa.findMany({
    select: { id: true, anchoCm: true, largoCm: true, ancho2Cm: true, largo2Cm: true },
  })).map((e) => [e.id, { anchoCm: Number(e.anchoCm), largoCm: Number(e.largoCm), ancho2Cm: Number(e.ancho2Cm), largo2Cm: Number(e.largo2Cm) }]));
  // estampaId → todas las estampas de la prenda que la usa (ella incluida).
  const caras = new Map<string, string[]>();
  for (const p of productos) {
    const ids = (p.estampas as { estampaId: string }[]).map((l) => l.estampaId).filter(Boolean);
    for (const id of ids) if (!caras.has(id)) caras.set(id, ids);
  }

  // Los Decimal salen como string por JSON: se pasan a número acá, en el borde, para que
  // la pantalla no tenga que acordarse de convertir cada uno.
  return NextResponse.json(ordenes.map((o) => ({
    ...o,
    precioMetroDtf: Number(o.precioMetroDtf),
    items: o.items.map((i) => ({
      ...i,
      estampa: i.estampa ? {
        codigoInterno: i.estampa.codigoInterno, nombreComercial: i.estampa.nombreComercial,
        anchoCm: Number(i.estampa.anchoCm), largoCm: Number(i.estampa.largoCm),
        ancho2Cm: Number(i.estampa.ancho2Cm), largo2Cm: Number(i.estampa.largo2Cm),
      } : null,
      // Todas las caras de la prenda. Si la estampa del ítem no está en ningún producto,
      // va sola: es lo único que se sabe, y decir de más sería peor.
      estampasPrenda: i.estampaId
        ? (caras.get(i.estampaId) ?? [i.estampaId]).map((id) => medidas.get(id)).filter(Boolean)
        : [],
    })),
    comprasDtf: o.comprasDtf.map((c) => ({ id: c.id, fecha: c.fecha, metros: Number(c.metros), precioMetro: Number(c.precioMetro), flete: Number(c.flete), gastoId: c.gastoId })),
  })));
}

export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'reposicion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { tipo, origen, notas, items } = parsed.data;

  const estampaIds = [...new Set(items.map((i) => i.estampaId).filter((x): x is string => !!x))];
  if (estampaIds.length > 0) {
    const existen = await prisma.estampa.count({ where: { id: { in: estampaIds } } });
    if (existen !== estampaIds.length) return NextResponse.json({ error: 'Alguna estampa no existe' }, { status: 400 });
  }

  // SNAPSHOT del $/metro del DTF. Lo que se pide hoy se costea al precio de hoy: si mañana
  // sube, esta orden no se reescribe. Mismo criterio que `pasaje_items.costoUnitario`.
  const [cfg, comprasDtf] = await Promise.all([
    prisma.configCostos.findUnique({ where: { id: 'singleton' }, select: { dtfPrecioMetro: true } }),
    prisma.compraDtf.findMany({ orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }], take: 5 }),
  ]);
  const precioDtf = resolverPrecioDtf(
    comprasDtf.map((c) => ({ id: c.id, fecha: c.fecha, metros: Number(c.metros), precioMetro: Number(c.precioMetro), flete: Number(c.flete) })),
    cfg?.dtfPrecioMetro,
  ).precioMetro ?? 0;

  const orden = await prisma.$transaction(async (tx) => {
    const creada = await tx.ordenEstampa.create({
      data: {
        creadoPor: session.nombre,
        tipo,
        origen,
        precioMetroDtf: new Prisma.Decimal(precioDtf),
        notas: notas?.trim() || null,
        items: { create: items.map((i) => ({ gnId: i.gnId ?? null, gnNombre: i.gnNombre || null, estampaId: i.estampaId ?? null, skuLiso: i.skuLiso, talle: i.talle, cantidad: i.cantidad })) },
      },
      include: { items: { include: { estampa: { select: { codigoInterno: true, nombreComercial: true } } } } },
    });
    // Pedir el DTF es lo que mueve la estampa de 'pensada' a 'pedida'. Hasta ahora
    // ese ciclo existía y no lo movía nadie. Las que ya venían de más adelante en el
    // ciclo no retroceden — y por eso se devuelve CUÁNTAS se movieron: la pantalla no
    // puede afirmar el cambio de estado sin saberlo.
    let estampasPedidas = 0;
    if (estampaIds.length > 0) {
      const r = await tx.estampa.updateMany({ where: { id: { in: estampaIds }, estado: 'pensada' }, data: { estado: 'pedida' } });
      estampasPedidas = r.count;
    }
    return { ...creada, estampasPedidas };
  });
  return NextResponse.json(orden, { status: 201 });
}
