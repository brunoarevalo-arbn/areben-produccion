import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { CortarLoteSchema } from '@/lib/validators/produccion';
import { registrarCorteOrden, CorteError } from '@/lib/produccion/corte';

type Ctx = { params: Promise<{ loteId: string }> };

// Corte por lote: registra una ficha por cada color (OP) en una sola transacción.
// Lo compartido (avíos, cortador, costo del servicio) se aplica a todos; el costo
// del corte se reparte entre los colores. Si un color falla, no se registra ninguno.
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { loteId } = await params;
  const parsed = CortarLoteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { colores, avios, cortadorId, costoCorte, modoCosto, notas } = parsed.data;

  // Validar que todas las OPs pertenezcan al lote y no tengan ficha cargada.
  const ordenIds = colores.map((c) => c.ordenId);
  if (new Set(ordenIds).size !== ordenIds.length) {
    return NextResponse.json({ error: 'Hay colores repetidos' }, { status: 400 });
  }
  const ordenes = await prisma.ordenProduccion.findMany({
    where: { id: { in: ordenIds } },
    select: { id: true, loteId: true, fichaCorteCargada: true, sku: true },
  });
  const ordenMap = new Map(ordenes.map((o) => [o.id, o]));
  for (const c of colores) {
    const o = ordenMap.get(c.ordenId);
    if (!o) return NextResponse.json({ error: `OP ${c.ordenId} no encontrada` }, { status: 400 });
    if (o.loteId !== loteId) return NextResponse.json({ error: `La OP ${o.sku ?? c.ordenId} no pertenece a este lote` }, { status: 400 });
    if (o.fichaCorteCargada) return NextResponse.json({ error: `La OP ${o.sku ?? c.ordenId} ya tiene ficha cargada` }, { status: 400 });
  }

  // Reparto del costo de corte entre colores. Por unidad: costo × unidades del color.
  // Total: proporcional a las unidades; el último color absorbe el redondeo para que
  // la suma coincida exactamente con lo ingresado.
  const unidades = colores.map((c) => c.cortesPorTalle.reduce((s, t) => s + t.cantidad, 0));
  const totalU = unidades.reduce((s, u) => s + u, 0);
  const costoBase = costoCorte || 0;

  const costoPorColor: number[] = (() => {
    if (costoBase <= 0 || totalU === 0) return colores.map(() => 0);
    if (modoCosto === 'unidad') return unidades.map((u) => Math.round(costoBase * u * 100) / 100);
    let acum = 0;
    return colores.map((_, i) => {
      if (i === colores.length - 1) return Math.round((costoBase - acum) * 100) / 100;
      const parte = Math.round((costoBase * unidades[i] / totalU) * 100) / 100;
      acum += parte;
      return parte;
    });
  })();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const fichas = [];
      for (let i = 0; i < colores.length; i++) {
        const c = colores[i];
        const ficha = await registrarCorteOrden(tx, c.ordenId, {
          consumoRollos:  c.consumoRollos,
          cortesPorTalle: c.cortesPorTalle,
          avios,
          cortadorId,
          costoCorte: costoPorColor[i] > 0 ? costoPorColor[i] : undefined,
          notas,
        }, session);
        fichas.push(ficha);
      }
      return fichas;
    });
    return NextResponse.json({ ordenes: result }, { status: 201 });
  } catch (e) {
    if (e instanceof CorteError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
