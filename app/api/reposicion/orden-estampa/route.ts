import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
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
        include: { estampa: { select: { codigoInterno: true, nombreComercial: true } } },
      },
    },
  });
  return NextResponse.json(ordenes);
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

  const orden = await prisma.$transaction(async (tx) => {
    const creada = await tx.ordenEstampa.create({
      data: {
        creadoPor: session.nombre,
        tipo,
        origen,
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
