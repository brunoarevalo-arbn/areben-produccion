import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { CambioEstadoSchema, ESTADO_SIGUIENTE } from '@/lib/validators/produccion';
import { deshacerCierreOrden } from '@/lib/produccion/cierre';
import { EstadoOP } from '@prisma/client';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = CambioEstadoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const orden = await prisma.ordenProduccion.findUnique({ where: { id } });
  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });

  const { estado: nuevoEstado, notas } = parsed.data;
  const estadoActual = orden.estado;

  // Para entrar a COSTURA hace falta el SKU (se genera auto desde marca+prenda+color).
  if (nuevoEstado === 'COSTURA' && !orden.sku?.trim()) {
    return NextResponse.json({ error: 'Asigná el SKU antes de mandar a costura.' }, { status: 400 });
  }

  const permitidos = ESTADO_SIGUIENTE[estadoActual] || [];
  const esRetroceso = !permitidos.includes(nuevoEstado);

  if (esRetroceso) {
    const retrocesosPermitidos = Object.entries(ESTADO_SIGUIENTE)
      .filter(([, nexts]) => nexts.includes(estadoActual))
      .map(([k]) => k);

    if (!retrocesosPermitidos.includes(nuevoEstado) && nuevoEstado !== estadoActual) {
      return NextResponse.json(
        { error: `No se puede pasar de ${estadoActual} a ${nuevoEstado}` },
        { status: 400 }
      );
    }

    if (!notas?.trim()) {
      return NextResponse.json(
        { error: 'Motivo obligatorio para retroceder de estado' },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Si se retrocede DESDE "liso terminado" (a costura/corte/pendiente), hay que
    // deshacer el ingreso a stock y reponer los avíos; si no, el stock queda inflado.
    if (estadoActual === 'TERMINADO_SIN_ESTAMPA' && nuevoEstado !== 'CERRADA') {
      await deshacerCierreOrden(tx, id);
    }
    const op = await tx.ordenProduccion.update({
      where: { id },
      data: {
        estado: nuevoEstado as EstadoOP,
        // Producción termina en TERMINADO_SIN_ESTAMPA (liso terminado).
        terminadoAt: (nuevoEstado === 'TERMINADO_SIN_ESTAMPA' || nuevoEstado === 'CERRADA') ? new Date() : null,
      },
    });
    await tx.estadoTransicion.create({
      data: {
        ordenId: id,
        estadoAnterior: estadoActual,
        estadoNuevo: nuevoEstado as EstadoOP,
        usuarioId: session.id,
        notas: notas?.trim() || null,
      },
    });
    return op;
  });

  return NextResponse.json(updated);
}
