import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { siguienteNumeroSku, formatSku } from '@/lib/produccion/sku';
import { retryOnUniqueConflict } from '@/lib/db/retry';
import { cortadorPredeterminado } from '@/lib/produccion/cortador-default';
import { z } from 'zod';

const BodySchema = z.object({
  marca:       z.string().min(1),  // abreviatura del catálogo (ej. "ZAT")
  prenda:      z.string().min(1),  // abreviatura del catálogo (ej. "TOP")
  descripcion: z.string().optional(),
  notas:       z.string().optional(),
  variantes:   z.array(z.object({
    color:    z.string().min(1),   // abreviatura del catálogo (ej. "NG")
    cantidad: z.coerce.number().int().min(1),
  })).min(1),
});

// Crea una producción agrupada: un LoteProduccion (madre, por molde/prenda) + una
// OrdenProduccion por color, cada una con su SKU generado. Es la entrada del flujo
// "Nueva producción". Las OP creadas funcionan igual que las sueltas, pero quedan
// hermanadas por loteId.
export async function POST(req: NextRequest) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const marca  = parsed.data.marca.trim().toUpperCase();
  const prenda = parsed.data.prenda.trim().toUpperCase();
  const descripcion = parsed.data.descripcion?.trim() || null;
  const notas       = parsed.data.notas?.trim() || null;

  // Dedupe de colores (sumando cantidades) para no generar SKUs duplicados en un lote.
  const porColor = new Map<string, number>();
  for (const v of parsed.data.variantes) {
    const c = v.color.trim().toUpperCase();
    porColor.set(c, (porColor.get(c) || 0) + v.cantidad);
  }

  // El SKU usa la abreviatura; la OP guarda el nombre legible de la marca para mostrar.
  const marcaEntry = await prisma.skuCatalogo.findFirst({
    where:  { categoria: 'marca', abreviatura: marca },
    select: { nombre: true },
  });
  const marcaNombre = marcaEntry?.nombre || marca;

  // Mismo criterio que la OP suelta: el cortador predeterminado se asigna solo a
  // cada color del lote (solo la FK, no el snapshot `cortador`).
  const pred = await cortadorPredeterminado();

  const result = await retryOnUniqueConflict(() => prisma.$transaction(async (tx) => {
    const lote = await tx.loteProduccion.create({
      data: { marca: marcaNombre, prenda, descripcion, notas, creadoPor: session.nombre },
    });

    const ordenes = [];
    for (const [color, cantidad] of porColor) {
      const prefijo = `${marca}-${prenda}-${color}-`;
      const numero  = await siguienteNumeroSku(tx, prefijo);
      const sku     = formatSku(prefijo, numero);
      const op = await tx.ordenProduccion.create({
        data: {
          sku, descripcion, notas, cantidad,
          marca:       marcaNombre,
          creadoPor:   session.nombre,
          loteId:      lote.id,
          cortadorId:  pred?.id ?? null,
          corteEstado: pred ? 'asignado' : null,
        },
      });
      await tx.estadoTransicion.create({
        data: {
          ordenId:        op.id,
          estadoAnterior: null,
          estadoNuevo:    'PENDIENTE',
          usuarioId:      session.id,
          notas:          'OP creada (lote)',
        },
      });
      ordenes.push(op);
    }
    return { lote, ordenes };
  }));

  return NextResponse.json(result, { status: 201 });
}
