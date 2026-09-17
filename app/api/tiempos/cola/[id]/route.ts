import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

// Acción acotada para la tablet de costura: la costurera AVISA que terminó de coser.
//
// 🔴 Antes esto avanzaba la OP de COSTURA a TERMINADO_SIN_ESTAMPA directamente: sin
// contar por talle, sin ingresar nada a `stock_terminado` y sin descontar los avíos. Esa
// producción quedaba fuera de la cola y fuera del stock —desaparecía— y encima dejaba la
// OP en un estado desde el que `terminarCosturaOrden` ya no la acepta (exige COSTURA),
// así que el taller no podía ingresarla ni aunque se diera cuenta.
//
// Ahora el aviso no mueve el estado ni el stock: sólo marca la OP y la saca de la cola de
// la tablet. El conteo por talle y el ingreso los hace el taller, que es quien cuenta.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const orden = await prisma.ordenProduccion.findUnique({ where: { id } });
  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });

  if (orden.estado !== 'COSTURA') {
    return NextResponse.json(
      { error: `La orden ya no está en costura (estado: ${orden.estado})` },
      { status: 400 },
    );
  }
  if (orden.avisoCosturaAt) {
    return NextResponse.json({ error: 'Ya avisaste que esta orden está terminada' }, { status: 400 });
  }

  const [updated] = await prisma.$transaction([
    prisma.ordenProduccion.update({
      where: { id },
      data: { avisoCosturaAt: new Date(), avisoCosturaPor: session.nombre },
    }),
    // El aviso queda en la bitácora de la OP, con el estado sin moverse: es lo que deja
    // ver después "avisó a las 14:32 y se contó a las 18:10".
    prisma.estadoTransicion.create({
      data: {
        ordenId: id,
        estadoAnterior: 'COSTURA',
        estadoNuevo: 'COSTURA',
        usuarioId: session.id,
        notas: `${session.nombre} avisó desde la tablet que terminó de coser. Falta contar por talle e ingresar a stock.`,
      },
    }),
  ]);

  return NextResponse.json(updated);
}

// Deshacer el aviso: la costurera se equivocó de orden, o el taller se la devuelve.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const orden = await prisma.ordenProduccion.findUnique({ where: { id } });
  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });
  if (!orden.avisoCosturaAt) return NextResponse.json({ error: 'Esta orden no tiene aviso' }, { status: 400 });

  const updated = await prisma.ordenProduccion.update({
    where: { id },
    data: { avisoCosturaAt: null, avisoCosturaPor: null },
  });
  return NextResponse.json(updated);
}
