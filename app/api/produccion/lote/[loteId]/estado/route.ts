import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { CambioEstadoLoteSchema, ESTADO_SIGUIENTE } from '@/lib/validators/produccion';
import { EstadoOP } from '@prisma/client';

type Ctx = { params: Promise<{ loteId: string }> };

// Avance de estado por lote (solo hacia adelante, sin deshacer nada):
//  - COSTURA: pasa a costura todos los colores en un estado que lo permita (con SKU).
//  - CERRADA: cierra todos los colores en "Listo" (TERMINADO_SIN_ESTAMPA).
// Los colores que no aplican se saltan. Atómico.
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { loteId } = await params;
  const parsed = CambioEstadoLoteSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { estado: nuevoEstado, notas } = parsed.data;
  const ordenes = await prisma.ordenProduccion.findMany({
    where: { loteId },
    select: { id: true, estado: true, sku: true },
  });
  if (ordenes.length === 0) return NextResponse.json({ error: 'El lote no tiene órdenes' }, { status: 404 });

  // Elegibles = aquellos cuyo estado actual permite avanzar al destino.
  const elegibles = ordenes.filter((o) => (ESTADO_SIGUIENTE[o.estado] || []).includes(nuevoEstado));

  if (nuevoEstado === 'COSTURA') {
    const sinSku = elegibles.filter((o) => !o.sku?.trim());
    if (sinSku.length > 0) {
      return NextResponse.json({ error: 'Hay colores sin SKU; asignalo antes de mandar a costura.' }, { status: 400 });
    }
  }

  if (elegibles.length === 0) {
    return NextResponse.json({ error: 'Ningún color del lote puede avanzar a ese estado' }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    for (const o of elegibles) {
      await tx.ordenProduccion.update({
        where: { id: o.id },
        data: {
          estado: nuevoEstado as EstadoOP,
          terminadoAt: nuevoEstado === 'CERRADA' ? new Date() : undefined,
        },
      });
      await tx.estadoTransicion.create({
        data: {
          ordenId: o.id,
          estadoAnterior: o.estado,
          estadoNuevo: nuevoEstado as EstadoOP,
          usuarioId: session.id,
          notas: notas?.trim() || (nuevoEstado === 'COSTURA' ? 'A costura (lote)' : 'Cerrada (lote)'),
        },
      });
    }
  });

  return NextResponse.json({ ok: true, avanzados: elegibles.length, total: ordenes.length }, { status: 201 });
}
